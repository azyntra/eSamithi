const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db');
const minutes = require('../lib/minutes');

// Meeting Records routes shared by the member app (/me/meeting-records) and
// the office web (/meeting-records). Each mount supplies resolveActor — who is
// acting and what they may do — and lib/minutes.js applies one set of rules
// (docs/MEETING-MINUTES-REQUIREMENTS.md §2, §7).

const ID = '(\\d+)';

const pageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

function buildRoutes(resolveActor, { kind }) {
  const router = express.Router();
  const actorKey = (req) => `${req.tenant || ''}|${req.actor ? (req.actor.memberId ? `m${req.actor.memberId}` : `u${req.actor.userId}`) : 'anon'}`;
  const limiter = (windowMs, limit, message) => rateLimit({
    windowMs, limit, standardHeaders: true, legacyHeaders: false, keyGenerator: actorKey,
    message: { error: message, code: 'RATE_LIMITED' }
  });
  const commentLimiter = limiter(60 * 60 * 1000, 10, 'Too many comments in an hour. Please wait a little.');
  const uploadLimiter = limiter(24 * 60 * 60 * 1000, 300, 'Too many uploads today.');
  const publishLimiter = limiter(24 * 60 * 60 * 1000, 20, 'Too many publications today.');

  router.use(async (req, _res, next) => {
    try {
      req.actor = await resolveActor(req);
      next();
    } catch (err) { next(err); }
  });

  const h = (fn) => async (req, res, next) => {
    try {
      res.json(await fn(req, getPool(), req.tenant, req.actor));
    } catch (err) { next(err); }
  };

  // Reading
  router.get('/', h((req, pool, _t, actor) => minutes.browse(pool, actor, {
    year: req.query.year, month: req.query.month, status: req.query.status, page: req.query.page
  })));
  router.get('/secretary', h((_req, pool, _t, actor) => minutes.secretaryHub(pool, actor)));
  router.get(`/:id${ID}`, h((req, pool, t, actor) => minutes.getReport(pool, t, actor, req.params.id)));
  router.get(`/:id${ID}/versions/:no${ID}`, h((req, pool, t, actor) => minutes.getReport(pool, t, actor, req.params.id, req.params.no)));
  router.get(`/:id${ID}/comments`, h((req, pool, _t, actor) => minutes.listComments(pool, actor, req.params.id)));

  // Drafts
  router.post('/', h((req, pool, t, actor) => minutes.createReport(pool, t, actor, req.body || {})));
  router.post(`/:id${ID}/revision`, h((req, pool, t, actor) => minutes.startRevision(pool, t, actor, req.params.id)));
  router.get(`/:id${ID}/draft`, h((req, pool, t, actor) => {
    if (!actor.canPublish) throw Object.assign(new Error('Only the Secretary can see drafts'), { statusCode: 403, code: kind === 'member' ? 'NOT_SECRETARY' : 'NOT_PUBLISHER' });
    return minutes.draftView(pool, t, req.params.id);
  }));
  router.patch(`/:id${ID}/draft`, h((req, pool, t, actor) => minutes.updateDraft(pool, t, actor, req.params.id, req.body || {})));
  router.delete(`/:id${ID}/draft`, h((req, pool, t, actor) => minutes.discardDraft(pool, t, actor, req.params.id)));

  router.post(`/:id${ID}/draft/pages`, uploadLimiter, (req, res, next) => {
    // Permission before reading 10 MB of photo
    if (!req.actor.canPublish) return next(Object.assign(new Error('Only the Secretary can add pages'), { statusCode: 403, code: kind === 'member' ? 'NOT_SECRETARY' : 'NOT_PUBLISHER' }));
    pageUpload.single('photo')(req, res, next);
  }, h((req, pool, t, actor) => minutes.addPage(pool, t, actor, req.params.id, {
    clientRef: req.body && req.body.client_ref,
    replacePageId: req.body && req.body.replace_page_id ? req.body.replace_page_id : null,
    buffer: req.file ? req.file.buffer : null
  })));
  router.put(`/:id${ID}/draft/pages/order`, h((req, pool, t, actor) => minutes.reorderPages(pool, t, actor, req.params.id, (req.body || {}).page_ids)));
  router.patch(`/:id${ID}/draft/pages/:pid${ID}`, h((req, pool, t, actor) => minutes.rotatePage(pool, t, actor, req.params.id, req.params.pid, req.body || {})));
  router.delete(`/:id${ID}/draft/pages/:pid${ID}`, h((req, pool, t, actor) => minutes.deletePage(pool, t, actor, req.params.id, req.params.pid)));

  router.post(`/:id${ID}/draft/audio/uploads`, uploadLimiter, h((req, pool, t, actor) => minutes.initAudio(pool, t, actor, req.params.id, req.body || {})));
  router.put(
    `/:id${ID}/draft/audio/uploads/:uid`,
    (req, _res, next) => (req.actor.canPublish ? next() : next(Object.assign(new Error('Only the Secretary can upload audio'), { statusCode: 403, code: kind === 'member' ? 'NOT_SECRETARY' : 'NOT_PUBLISHER' }))),
    express.raw({ type: () => true, limit: '6mb' }),
    h((req, pool, t, actor) => minutes.audioChunk(pool, t, actor, req.params.id, req.params.uid, req.headers['content-range'], req.body))
  );
  router.post(`/:id${ID}/draft/audio/uploads/:uid/complete`, h((req, pool, t, actor) => minutes.completeAudio(pool, t, actor, req.params.id, req.params.uid)));
  router.delete(`/:id${ID}/draft/audio`, h((req, pool, t, actor) => minutes.deleteAudio(pool, t, actor, req.params.id)));
  router.post(`/:id${ID}/draft/pdf`, h((req, pool, t, actor) => minutes.previewPdf(pool, t, actor, req.params.id)));
  router.post(`/:id${ID}/draft/publish`, publishLimiter, h((req, pool, t, actor) => minutes.publish(pool, t, actor, req.params.id, req.body || {})));

  // Comments
  router.post(`/comments/:cid${ID}/reply`, h((req, pool, _t, actor) => minutes.replyToComment(pool, actor, req.params.cid, req.body || {})));
  router.post(`/comments/:cid${ID}/addressed`, h((req, pool, t, actor) => minutes.setAddressed(pool, t, actor, req.params.cid, req.body || {})));
  router.post(`/comments/:cid${ID}/hide`, h((req, pool, _t, actor) => minutes.setHidden(pool, actor, req.params.cid, true, (req.body || {}).reason)));
  router.post(`/comments/:cid${ID}/unhide`, h((req, pool, _t, actor) => minutes.setHidden(pool, actor, req.params.cid, false)));

  if (kind === 'member') {
    router.post(`/:id${ID}/comments`, commentLimiter, h((req, pool, t, actor) => minutes.addComment(pool, t, actor, req.params.id, req.body || {})));
    router.delete(`/comments/:cid${ID}`, h((req, pool, _t, actor) => minutes.deleteOwnComment(pool, actor, req.params.cid)));
    router.post(`/comments/:cid${ID}/report`, commentLimiter, h((req, pool, _t, actor) => minutes.reportComment(pool, actor, req.params.cid)));
  } else {
    router.post(`/:id${ID}/versions/:no${ID}/withdraw`, h((req, pool, _t, actor) => minutes.setWithdrawn(pool, actor, req.params.id, req.params.no, true, (req.body || {}).reason)));
    router.post(`/:id${ID}/versions/:no${ID}/restore`, h((req, pool, _t, actor) => minutes.setWithdrawn(pool, actor, req.params.id, req.params.no, false)));
  }

  // Errors this feature raises carry a code; a resumable upload also says
  // where to resume. Everything else goes to the global handler.
  router.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ error: tooBig ? 'That photo is too large (at most 10 MB)' : 'Send one photo in the field "photo"', code: tooBig ? 'FILE_TOO_LARGE' : 'BAD_UPLOAD' });
    }
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Chunk too large (at most 5 MB)', code: 'FILE_TOO_LARGE' });
    if (!err || !err.statusCode || typeof err.code !== 'string') return next(err);
    const body = { error: err.message, code: err.code };
    if (err.received_bytes !== undefined) body.received_bytes = err.received_bytes;
    return res.status(err.statusCode).json(body);
  });
  return router;
}

module.exports = { buildRoutes };
