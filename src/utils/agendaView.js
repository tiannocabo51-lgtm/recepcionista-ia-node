const { readFileSync } = require('fs');
const { join } = require('path');
const html = readFileSync(join(__dirname, 'agendaView.html'), 'utf8');
module.exports = function agendaView() { return html; };
