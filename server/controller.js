const db = require('../database/models/index.js');
const passport = require('./middleware/passport.js');
const Promise = require('bluebird');
const bodyParser = require('body-parser');
const { transporter, template } = require('./email.js');

const post = {};
const get = {};
const patch = {};

// THIS IS AN EXAMPLE OF QUERY STRING
// get.user = (req, res) => {
//   db.sequelize.query(`select * from "Users"`, { type: db.sequelize.QueryTypes.SELECT})
//   .then(users => console.log(users))
//   .catch(err => console.log('error'))
// }

/* -------- GET REQUESTS --------- */
get.invites = (req, res) => {
  console.log('in get invites');
  res.end();
}

get.logout = (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect('/');
};

get.topicBoards = (req, res) => {
  return db.Board.findAll({
    where: req.query
  })
    .then(data => {
      let boardArr = data.map(item => item.dataValues)
      res.json(boardArr);
    })
    .catch(error => {
      console.log(error);
      res.status(500);
      res.end();
    })
}

// Retrieve all events of user after login
get.userEvents = (req, res) => {
  return db.EventUser.findAll({
    where: {
      UserId: req.user.id
    },
    include: [
      {
        model: db.Event,
        required: true,
      }
    ],
  })
    .then(data => {
      let eventArr = data.map(item => item.dataValues.Event.dataValues);
      res.json(eventArr);
    })
    .catch(error => {
      console.log('error:', error);
      res.status(500);
      res.end();
    });
}

/* -------- PATCH REQUESTS --------- */


/* -------- POST REQUESTS --------- */

post.addTopicBoard = (req, res) => {
  const query = {
    EventId: req.body.eventId,
    title: req.body.addTopicTitle
  }

  return db.Board.create(query)
    .then(() => res.end())
    .catch((err) => {
      console.log(err);
      res.status(err.status);
      res.end();
    })
}

post.addUserToEvent = (event, user, res) => {
  const query = {
    EventId: event.id,
    UserId: user.id
  }

  return db.EventUser.create(query);
}

post.createEvent = (req, res) => {
  const query = {
    title: req.body.createEventTitle,
    location: req.body.createEventLocation
  }

  return db.Event.create(query)
    .then((({ dataValues }) => {
      return post.addUserToEvent(dataValues, req.user)
        .then((data) => {
          res.json(data);
        })
        .catch((err) => {
          console.log(err);
          res.status(err.status);
          res.end();
        })
    }))
    .catch((err) => { console.log(err) })
}

post.login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err || !user) {
      res.status(422).send(info);
    } else {
      user.password = undefined;
      user.salt = undefined;
      req.login(user, (error) => {
        if (error) {
          console.log('error logging in', error);
          res.status(400).send(error);
        } else {
          res.json(user.dataValues);
        }
      });
    }
  })(req, res, next);
};

post.sendEmailInvites = (req, res) => {
  let emails = req.body.validatedEmails;
  let validator = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  for (var i = 0; i < emails.length; i++) {
    let email = emails[i].trim();
    if (!validator.test(email)) {
      res.status(422);
      res.end();
    }
  }

  emails.forEach((email) => {
    var userData;
    return db.User.findOne({ where: { email: email } })
      .then(res => {
        userData = res ? res.dataValues : null;
        return transporter.sendMail(template(email))
          .then(() => {
            db.addInvite(email, userData, req.body.event, true, res)
          })
          .catch(err => {
            console.log(err);
            db.addInvite(email, userData, req.body.event, false, res);
          })
      })
        .catch(err => { console.log(err) })
  })

  res.end();
};

post.signup = (req, res) => {
  return db.saveUser(req.body)
    .then(() => {
      res.status(200);
      res.end();
    })
    .catch((err) => {
      console.log(err);
      res.send(err.status);
      res.end();
    })
};

module.exports.get = get;
module.exports.post = post;
module.exports.patch = patch;
