const config = require('../utils/config');

function dashboardAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const [user, password] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
    if (user === config.dashboardUser && password === config.dashboardPassword) {
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Panel"');
  return res.status(401).send('Autenticación requerida.');
}

module.exports = dashboardAuth;
