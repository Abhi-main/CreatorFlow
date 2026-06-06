const nodemailer = require("nodemailer");
const env = require("../config/env");

let transport;

function getTransport() {
  if (transport) {
    return transport;
  }

  if (env.mail.host && env.mail.user) {
    transport = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: env.mail.secure,
      auth: {
        user: env.mail.user,
        pass: env.mail.pass
      }
    });
  } else {
    transport = nodemailer.createTransport({
      jsonTransport: true
    });
  }

  return transport;
}

async function sendMail({ to, subject, html }) {
  return getTransport().sendMail({
    from: env.mail.from,
    to,
    subject,
    html
  });
}

module.exports = {
  sendMail
};
