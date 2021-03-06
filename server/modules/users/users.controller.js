var _ = require('lodash')
var async = require('async')
var crypto = require('crypto')
var nodemailer = require('nodemailer')
var passport = require('passport')
var mongoose = require('mongoose')
var User = mongoose.model('users')

var settings = require('../../../configs/settings.js').get()

var secrets = {
  host: 'smtp.mandrillapp.com', // Gmail, SMTP
  port: '587',
  auth: {
    user: 'hackathonstarterdemo',
    pass: 'E1K950_ydLR4mHw12a0ldA'
  }
}

var jwt = require('jsonwebtoken')
// res.cookie('token', token)

/**
 * POST /authenticate
 * Authenticate Token.
 */
exports.postAuthenticate = function (req, res, next) {
  var redirect = req.body.redirect || false
  req.assert('email', 'Email is not valid').isEmail()
  req.assert('password', 'Password cannot be blank').notEmpty()
  var errors = req.validationErrors()
  if (errors) {
    return res.status(401).send({
      success: false,
      authenticated: false,
      msg: errors[0].msg,
      redirect: redirect
    })
  } else {
    User.findOne({
      email: req.body.email
    }, function (err, user) {
      if (err) throw err
      if (!user) {
        res.send({
          success: false,
          authenticated: false,
          msg: 'Authentication failed. User not found.',
          redirect: '/signin'
        })
      } else {
        user.comparePassword(req.body.password, function (err, isMatch) {
          if (isMatch && !err) {
            req.logIn(user, function (err) {
              if (err) {
                return next(err)
              }
              delete user['password']
              var token = jwt.sign({
                profile: user.profile,
                roles: user.roles,
                gravatar: user.gravatar,
                email: user.email,
                _id: user._id
              }, settings.jwt.secret, settings.jwt.options) // good for two hours
              res.cookie('token', token)
              res.json({
                success: true,
                authenticated: true,
                token: 'JWT ' + token,
                redirect: redirect
              })
            })
          } else {
            res.send({
              success: false,
              authenticated: false,
              msg: 'Authentication failed. Wrong password.',
              redirect: '/signin'
            })
          }
        })
      }
    })
  }
}

/**
 * GET /authenticate
 * Check Autherization of a user & return token.
 */
exports.getAuthenticate = function (req, res) {
  var redirect = req.body.redirect || false
  if (req.user) {
    var token = jwt.sign({
      profile: req.user.profile,
      roles: req.user.roles,
      gravatar: req.user.gravatar,
      email: req.user.email,
      _id: req.user._id
    }, settings.jwt.secret, settings.jwt.options)
    return res.status(200).send({
      user: token,
      success: true,
      authenticated: true,
      redirect: redirect
    })
  } else {
    res.status(200).send({
      user: {},
      success: false,
      authenticated: false,
      redirect: false
    })
  }
}
/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = function (req, res, next) {
  req.assert('email', 'Email is not valid').isEmail()
  req.assert('password', 'Password cannot be blank').notEmpty()

  var errors = req.validationErrors()
  var redirect = req.body.redirect || false
  if (errors) {
    return res.status(200).send('/signin')
  }
  passport.authenticate('local', function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(400).send({
        success: false,
        authenticated: false,
        msg: info.message,
        redirect: false
      })
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err)
      }
      delete user['password']
      var token = jwt.sign({
        profile: user.profile,
        roles: user.roles,
        gravatar: user.gravatar,
        email: user.email,
        _id: user._id
      }, settings.jwt.secret, settings.jwt.options) // good for two hours
      res.cookie('token', token)
      res.json({
        success: true,
        authenticated: true,
        user: 'JWT ' + token,
        redirect: redirect
      })
    })
  })(req, res, next)
}

/**
 * GET /logout
 * Log out.
 */
exports.logout = function (req, res) {
  req.logout()
  res.status(200).send('/')
}

/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = function (req, res) {
  if (req.user) {
    return res.status(200).send('/')
  }
  res.status(200).send('/account/signup')
}

/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = function (req, res, next) {
  req.assert('profile', 'Name must not be empty').notEmpty()
  req.assert('email', 'Email is not valid').isEmail()
  req.assert('password', 'Password must be at least 6 characters long').len(6)
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password)

  var errors = req.validationErrors()
  var redirect = req.body.redirect || false
  if (errors) {
    // req.flash('errors', errors)
    return res.status(400).send(errors)
  }

  var user = new User({
    email: req.body.email,
    password: req.body.password,
    profile: {
      name: req.body.profile.name
    }
  })

  User.findOne({ email: req.body.email }, function (err, existingUser) {
    if (err) {
      return res.status(400).send(err)
    }
    if (existingUser) {
      return res.status(400).send({ msg: 'Account with that email address already exists.' })
    }
    user.save(function (err) {
      if (err && err.code === 11000) {
        return res.status(400).send({ msg: 'Account with that email address already exists.' })
      } else if (err && err.name === 'ValidationError') {
        var keys = _.keys(err.errors)
        return res.status(400).send({ msg: err.errors[keys[0]].message }) // err.message
      } else if (err) {
        next(err)
      } else {
        req.logIn(user, function (err) {
          if (err) {
            return next(err)
          } else {
            delete user['password']
            var token = jwt.sign({
              profile: user.profile,
              roles: user.roles,
              gravatar: user.gravatar,
              email: user.email,
              _id: user._id
            }, settings.jwt.secret, settings.jwt.options) // good for two hours
            res.cookie('token', token)
            res.json({
              success: true,
              authenticated: true,
              user: 'JWT ' + token,
              redirect: redirect
            })
          }
        })
      }
    })
  })
}

/**
 * GET /account
 * Profile page.
 */
exports.getAccount = function (req, res) {
  res.status(200).send('/account/profile')
}

/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = function (req, res, next) {
  var redirect = req.body.redirect || false
  User.findById(req.user.id, function (err, user) {
    if (err) {
      return next(err)
    }
    user = _.merge(user, req.body)
    // user.email = req.body.email || ''
    // user.profile.name = req.body.name || ''
    // user.profile.gender = req.body.gender || ''
    // user.profile.location = req.body.location || ''
    // user.profile.website = req.body.website || ''
    user.save(function (err) {
      if (err) {
        return next(err)
      }
      // req.flash('success', { msg: 'Profile information updated.' })
      res.status(200).send({
        user: user,
        redirect: redirect
      })
    })
  })
}

/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = function (req, res, next) {
  req.assert('password', 'Password must be at least 4 characters long').len(4)
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password)

  var errors = req.validationErrors()

  if (errors) {
    return res.status(200).send(errors)
  }

  User.findById(req.user.id, function (err, user) {
    if (err) {
      return next(err)
    }
    user.password = req.body.password
    user.save(function (err) {
      if (err) {
        return next(err)
      }
      req.flash('success', { msg: 'Password has been changed.' })
      res.status(200).send('/account')
    })
  })
}

/**
 * POST /account/delete
 * Delete user account.
 */
exports.postDeleteAccount = function (req, res, next) {
  User.remove({ _id: req.user.id }, function (err) {
    if (err) {
      return next(err)
    }
    req.logout()
    res.status(200).send('/')
  })
}

/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = function (req, res) {
  if (req.isAuthenticated()) {
    return res.status(400).send({
      msg: 'Already authenticated',
      valid: false
    })
  } else {
    User
      .findOne({ resetPasswordToken: req.params.token })
      .where('resetPasswordExpires').gt(Date.now())
      .exec(function (err, user) {
        if (err) {
          return res.status(400).send(err)
        }
        if (!user) {
          // req.flash('errors', { msg: 'Password reset token is invalid or has expired.' })
          return res.status(400).send({
            msg: 'Password reset token is invalid or has expired.',
            valid: false
          })
        }
        res.status(200).send({
          msg: 'token is valid',
          valid: true
        })
      })
  }
}

/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = function (req, res, next) {
  req.assert('password', 'Password must be at least 4 characters long.').len(4)
  req.assert('confirmPassword', 'Passwords must match.').equals(req.body.password)
  var errors = req.validationErrors()

  if (errors) {
    // req.flash('errors', errors)
    return res.status(400).send({msg: errors})
  } else {
    async.waterfall([
      function (done) {
        User
          .findOne({ resetPasswordToken: req.params.token })
          .where('resetPasswordExpires').gt(Date.now())
          .exec(function (err, user) {
            if (err) {
              return next(err)
            }
            if (!user) {
              return res.status(400).send({msg: 'no user found to reset password for. please hit reset password to get another token'})
            }
            user.password = req.body.password
            user.resetPasswordToken = undefined
            user.resetPasswordExpires = undefined
            user.save(function (err) {
              if (err) {
                return next(err)
              }
              req.logIn(user, function (err) {
                done(err, user)
              })
            })
          })
      },
      function (user, done) {
        var transporter = nodemailer.createTransport({
          host: secrets.host, // Gmail, SMTP
          port: secrets.port,
          auth: {
            user: secrets.auth.user,
            pass: secrets.auth.pass
          }
        })

        var mailOptions = {
          to: user.email,
          from: 'MEANSTACKJS@meanstackjs.com',
          subject: 'Your Mean Stack JS password has been changed',
          text: 'Hello,\n\n' +
            'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
        }
        transporter.sendMail(mailOptions, function (err) {
          done(err, user)
        })
      }
    ], function (err, user) {
      if (err) {
        return next(err)
      }
      delete user.password
      var redirect = req.body.redirect || '/'
      res.status(200).send({
        success: true,
        authenticated: true,
        user: user,
        redirect: redirect
      })
    })
  }
}

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = function (req, res) {
  if (req.isAuthenticated()) {
    return res.status(200).send('/')
  }
  res.status(200).send('/account/forgot')
}

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = function (req, res, next) {
  req.assert('email', 'Please enter a valid email address.').isEmail()

  var errors = req.validationErrors()

  if (errors) {
    return res.status(400).send(errors)
  }

  async.waterfall([
    function (done) {
      crypto.randomBytes(16, function (err, buf) {
        var token = buf.toString('hex')
        done(err, token)
      })
    },
    function (token, done) {
      User.findOne({ email: req.body.email.toLowerCase() }, function (err, user) {
        if (err) {
          return res.status(400).send(err)
        }
        if (!user) {
          return res.status(200).send('/forgot')
        }
        user.resetPasswordToken = token
        user.resetPasswordExpires = Date.now() + 3600000 // 1 hour
        user.save(function (err) {
          done(err, token, user)
        })
      })
    },
    function (token, user, done) {
      var transporter = nodemailer.createTransport({
        host: secrets.host, // Gmail, SMTP
        port: secrets.port,
        auth: {
          user: secrets.auth.user,
          pass: secrets.auth.pass
        }
      })
      var mailOptions = {
        to: user.email,
        from: 'MEANSTACKJS@MEANSTACKJS.com',
        subject: 'Reset your password on MEANSTACKJS ',
        text: 'You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      }
      transporter.sendMail(mailOptions, function (err) {
        done(err, 'done')
      })
    }
  ], function (err) {
    if (err) {
      return next(err)
    }
    res.status(200).send({ msg: 'Email has been sent' })
  })
}
