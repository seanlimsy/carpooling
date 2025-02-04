const sql_query = require('../sql');
const passport = require('passport');
const bcrypt = require('bcrypt')
const fs = require('fs')
const moment = require('moment')

// Postgres SQL Connection
const { Pool } = require('pg');
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
  //ssl: true
});

const round = 10;
const salt  = bcrypt.genSaltSync(round);

function initRouter(app) {
	/*
	Routes needed:
	- profile page (update)
	- advertised rides (Create, Read, Update?, Delete)
	- requested rides (Create, Read, Update?, Delete)
	- confirmed rides (Read, Update?, Delete)
	- completed rides (Read)
	- individual ride page (Create, Read, Update?, Delete)
	 */

	/* GET */
	app.get('/'      , index );
	app.get('/search', search);
	app.get('/ridelist', ridelist);

	/* PROTECTED GET */
	app.get('/dashboard', passport.authMiddleware(), dashboard);
	app.get('/cars'    	, passport.authMiddleware(), cars);
	app.get('/journeys' , passport.authMiddleware(), journeys);
	app.get('/ride-details', passport.authMiddleware(), ride_details)
	app.get('/available-rides', passport.authMiddleware(), available_rides);
	app.get('/payment'  , passport.authMiddleware(), payment);
	app.get('/bids'    	, passport.authMiddleware(), bids);
	app.get('/driverinfo', passport.authMiddleware(), driverinfo);
	app.get('/')
  app.get('/passenger-journeys', passport.authMiddleware(), passenger_rides);

	//app.get('/rides', passport.authMiddleware(), rides);

	app.get('/register' , passport.antiMiddleware(), register );
	app.get('/login'		, passport.antiMiddleware(), login);
	app.get('/password' , passport.antiMiddleware(), retrieve );

	/* PROTECTED POST */
	app.post('/update_info', passport.authMiddleware(), update_info);
	app.post('/update_pass', passport.authMiddleware(), update_pass);
	app.post('/add_car'    , passport.authMiddleware(), add_car);
	app.post('/add_journey', passport.authMiddleware(), add_journey);
	app.post('/add_bid'		 , passport.authMiddleware(), add_bid);
	app.post('/del_car'    , passport.authMiddleware(), del_car);
	app.post('/del_journey', passport.authMiddleware(), del_journey);
	app.post('/del_bid'		 , passport.authMiddleware(), del_bid);
	app.post('/rate_passenger', passport.authMiddleware(), rate_passenger);

	app.post('/reg_user'   , passport.antiMiddleware(), reg_user);

	app.post('/add_payment', passport.authMiddleware(), add_payment);
	app.post('/add_driver_info', passport.authMiddleware(), add_driver_info);
	app.post('/add_upcoming_ride', passport.authMiddleware(), add_upcoming_ride)

	/* LOGIN */
	app.post('/login', passport.authenticate('local', {
		successRedirect: '/dashboard',
		failureRedirect: '/'
	}));

	/* LOGOUT */
	app.get('/logout', passport.authMiddleware(), logout);
}

// Render Function
function basic(req, res, page, other) {
	var info = {
		page: page,
		user: req.user.email,
		firstname: req.user.firstname,
		lastname : req.user.lastname,
		age			 : req.user.age,
		gender   : req.user.gender,
		is_driver: req.user.is_driver,
		is_passenger: req.user.is_passenger,
		dob			 : req.user.dob,
		gender	 : req.user.gender
	};
	if(other) {
		for(var fld in other) {
			info[fld] = other[fld];
		}
	}
	res.render(page, info);
}

function query(req, fld) {
	return req.query[fld] ? req.query[fld] : '';
}

function msg(req, fld, pass, fail) {
	var info = query(req, fld);
	return info ? (info=='pass' ? pass : fail) : '';
}

// GET
function index(req, res, next) {
	var ctx = 0, idx = 0, tbl, total;
	if(Object.keys(req.query).length > 0 && req.query.p) {
		idx = req.query.p-1;
	}
	pool.query(sql_query.query.page_lims, [idx*10], (err, data) => {
		if(err || !data.rows || data.rows.length == 0) {
			tbl = [];
		} else {
			tbl = data.rows;
		}
		pool.query(sql_query.query.ctx_games, (err, data) => {
			if(err || !data.rows || data.rows.length == 0) {
				ctx = 0;
			} else {
				ctx = data.rows[0].count;
			}
			total = ctx%10 == 0 ? ctx/10 : (ctx - (ctx%10))/10 + 1;
			console.log(idx*10, idx*10+10, total);
			if(!req.isAuthenticated()) {
				res.render('index', { page: '', auth: false, tbl: tbl, ctx: ctx, p: idx+1, t: total });
			} else {
				basic(req, res, 'index', { page: '', auth: true, tbl: tbl, ctx: ctx, p: idx+1, t: total });
			}
		});
	});
}

function login(req, res, next) {
	res.render('login', { page: 'login', auth: false });
}

function payment(req, res, next) {
	basic(req, res, 'payment', { info_msg: msg(req, 'info', 'Information updated successfully', 'Error in updating information'), pass_msg: msg(req, 'pass', 'Password updated successfully', 'Error in updating password'), auth: true });
}

function bids(req, res, next) {
	let email = req.user.email;
	var tbl, ctx = 0;
	pool.query(sql_query.query.single_passenger_bids, [email], (err,data) => {
		if (err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		if (!req.isAuthenticated()) {
			res.render('bids', {page: 'bids', auth: false, tbl: tbl, ctx: ctx});
		} else {
			basic(req, res, 'bids', {page: 'bids', auth: true, tbl: tbl, ctx: ctx, bid_msg: ''});
		}
	});
}

function ridelist(req, res, next) {
	pool.query(sql_query.query.all_available_journeys, [], (err, data) => {
		if(err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		if(!req.isAuthenticated()) {
			res.render('ridelist', { page: 'ridelist', auth: false, tbl: tbl, ctx: ctx });
		} else {
			basic(req, res, 'ridelist', { page: 'ridelist', auth: true, tbl: tbl, ctx: ctx });
		}
	});
}

function driverinfo(req, res, next) {
	basic(req, res, 'driverinfo', { info_msg: msg(req, 'info', 'Information updated successfully', 'Error in updating information'), pass_msg: msg(req, 'pass', 'Password updated successfully', 'Error in updating password'), auth: true });
}

function search(req, res, next) {
	var ctx  = 0, avg = 0, tbl;
	var game = "%" + req.query.gamename.toLowerCase() + "%";
	pool.query(sql_query.query.search_game, [game], (err, data) => {
		if(err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		if(!req.isAuthenticated()) {
			res.render('search', { page: 'search', auth: false, tbl: tbl, ctx: ctx });
		} else {
			basic(req, res, 'search', { page: 'search', auth: true, tbl: tbl, ctx: ctx });
		}
	});
}


function dashboard(req, res, next) {
	var ctx, tbl;
	pool.query(sql_query.query.get_fan, [req.user.email], (err, data) => {
		if (err) {
			ctx = 0;
			tbl = [];
			console.log(err);
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		basic(req, res, 'dashboard', { ctx: ctx, tbl: tbl, info_msg: msg(req, 'info', 'Information updated successfully', 'Error in updating information'), pass_msg: msg(req, 'pass', 'Password updated successfully', 'Error in updating password'), auth: true });
	});
	//basic(req, res, 'dashboard', {ctx: 0, tbl: [], info_msg: msg(req, 'info', 'Information updated successfully', 'Error in updating information'), pass_msg: msg(req, 'pass', 'Password updated successfully', 'Error in updating password'), auth: true });

}

//view cars
function cars(req, res, next) {
	var ctx = 0, avg = 0, tbl;
	pool.query(sql_query.query.avg_rating, [req.user.username], (err, data) => {
		if(err || !data.rows || data.rows.length == 0) {
			avg = 0;
		} else {
			avg = data.rows[0].avg;
		}
		pool.query(sql_query.query.all_cars, [req.user.email], (err, data) => {
			if(err || !data.rows || data.rows.length == 0) {
				ctx = 0;
				tbl = [];
			} else {
				ctx = data.rows.length;
				tbl = data.rows;
			}
			basic(req, res, 'cars', { ctx: ctx, avg: avg, tbl: tbl, car_msg: msg(req, 'add', 'Car added successfully', 'Car does not exist'), auth: true });
		});
	});
}

// function update_car(req, res, next) {
// 	let carp	late = req.body.car
// 	var ctx = 0, avg = 0, tbl = [];



// }

function del_car(req, res, next) {
	let carplate = req.body.car
	var ctx = 0, avg = 0, tbl = [];
	// pool.query(sql_query.query.avg_rating, [req.user.username], (err, data) => {
	// 	if(err || !data.rows || data.rows.length == 0) {
	// 		avg = 0;
	// 	} else {
	// 		avg = data.rows[0].avg;
	// 	}
		pool.query(sql_query.query.del_car, [req.user.email, carplate], (err, data) => {
			if(err) {
				console.log(err)
			} else {
				pool.query(sql_query.query.all_cars, [req.user.email], (err, data) => {
					if(err || !data.rows || data.rows.length == 0) {
						console.log(err)
						ctx = 0;
						tbl = [];
					} else {
						ctx = data.rows.length;
						tbl = data.rows;
						}
					basic(req, res, 'cars', { ctx: ctx, avg: avg, tbl: tbl, car_msg: msg(req, 'delete', 'Car deleted successfully', 'Car does not exist'), auth: true });
				});
			}
	});
}

function journeys(req, res, next) {
	var win = 0, avg = 0, ctx = 0, tbl, ctx_cars = 0, cars, ctx_completed = 0, tbl_completed = [], ctx_ongoing = 0, tbl_ongoing = [], ctx_upcoming = 0, tbl_upcoming = [];
	pool.query(sql_query.query.count_wins, [req.user.username], (err, data) => {
		if(err || !data.rows || data.rows.length == 0) {
			win = 0;
		} else {
			win = data.rows[0].count;
		}
		pool.query(sql_query.query.all_journeys, [req.user.email], (err, data) => {
			if(err || !data.rows || data.rows.length == 0) {
				ctx = 0;
				avg = 0;
				tbl = [];
			} else {
				ctx = data.rows.length;
				avg = win == 0 ? 0 : win/ctx;
				tbl = data.rows;
			}
			pool.query(sql_query.query.complete_journeys_driver, [req.user.email], (err, data) => {
				let journeys_occuring;
				if (err || !data.rows || data.rows.length == 0) {
					ctx_completed = 0;
					avg = 0;
					tbl_completed = [];
					ctx_upcoming = 0;
					tbl_upcoming = [];
					ctx_ongoing = 0;
					tbl_ongoing = [];
				} else {
					journeys_occuring = data.rows;
					for (var i = 0; i < journeys_occuring.length; i++) {
						if (journeys_occuring[i].journey_start_time === null && journeys_occuring[i].journey_end_time === null) {
							ctx_upcoming += 1
							tbl_upcoming.push(journeys_occuring[i])
						} else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time === null) {
							ctx_ongoing += 1
							tbl_ongoing.push(journeys_occuring[i])
						} else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time != null) {
							ctx_completed += 1
							tbl_completed.push(journeys_occuring[i])
						}
					}
				}
				pool.query(sql_query.query.all_cars, [req.user.email], (err, data) => {
					if(err || !data.rows || data.rows.length == 0) {
						ctx_cars = 0;
						cars = [];
					} else {
						ctx_cars = data.rows.length;
						cars = data.rows;
					}
					basic(req, res, 'journeys', { win: win, ctx_ongoing: ctx_ongoing, ctx_upcoming:ctx_upcoming, tbl_ongoing:tbl_ongoing, tbl_upcoming:tbl_upcoming, ctx: ctx, avg: avg, tbl: tbl, ctx_cars: ctx_cars, cars: cars, ctx_completed: ctx_completed, tbl_completed: tbl_completed, journey_msg: msg(req, 'add', 'Journey added successfully', 'Invalid parameter in journey'), auth: true });
				});
			});
		});
	});
}

function passenger_rides(req, res, next) {
	var ctx = 0, tbl, ctx_cars = 0, cars, ctx_completed = 0, tbl_completed = [], ctx_ongoing = 0, tbl_ongoing = [], ctx_upcoming = 0, tbl_upcoming = [];
	pool.query(sql_query.query.journeys_passenger, [req.user.email], (err, data) => {
		if(err || !data.rows || data.rows.length == 0) {
			ctx_completed = 0;
			tbl_completed = [];
			ctx_upcoming = 0;
			tbl_upcoming = [];
			ctx_ongoing = 0;
			tbl_ongoing = [];
		} else {
			var journeys_occuring = data.rows;
			for (var i = 0; i < journeys_occuring.length; i++) {
				if (journeys_occuring[i].journey_start_time === null && journeys_occuring[i].journey_end_time === null) {
					ctx_upcoming += 1
					tbl_upcoming.push(journeys_occuring[i])
				}
				else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time === null) {
					ctx_ongoing += 1
					tbl_ongoing.push(journeys_occuring[i])
				}
				else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time != null) {
					ctx_completed += 1
					tbl_completed.push(journeys_occuring[i])
				}
			}
		}
		basic(req, res, 'passenger_journeys', { ctx_ongoing: ctx_ongoing, ctx_upcoming:ctx_upcoming, tbl_ongoing:tbl_ongoing, tbl_upcoming:tbl_upcoming, ctx: ctx, tbl: tbl, ctx_completed: ctx_completed, tbl_completed: tbl_completed, journey_msg: msg(req, 'add', 'Journey added successfully', 'Invalid parameter in journey'), auth: true });
	});
}

function register(req, res, next) {
	res.render('register', { page: 'register', auth: false });
}
function retrieve(req, res, next) {
	res.render('retrieve', { page: 'retrieve', auth: false });
}


// POST
function rate_passenger(req, res, next) {
	var win = 0, avg = 0, ctx = 0, tbl, ctx_cars = 0, cars, ctx_completed = 0, tbl_completed = [], ctx_ongoing = 0, tbl_ongoing = [], ctx_upcoming = 0, tbl_upcoming = [];
	let rating = parseInt(req.body.optradio)
	let journeyStart = moment(new Date(req.body.info)).format('YYYY-MM-DD HH:mm:ss')
	pool.query(sql_query.query.rate_passenger, [journeyStart, req.user.email, rating], (err, data) => {
		if (err) {
			console.log(err)
		} else {
				pool.query(sql_query.query.all_journeys, [req.user.email], (err, data) => {
					if(err || !data.rows || data.rows.length == 0) {
						ctx = 0;
						avg = 0;
						tbl = [];
					} else {
						ctx = data.rows.length;
						avg = win == 0 ? 0 : win/ctx;
						tbl = data.rows;
					}
					pool.query(sql_query.query.complete_journeys_driver, [req.user.email], (err, data) => {
						if(err || !data.rows || data.rows.length == 0) {
							ctx_completed = 0;
							avg = 0;
							tbl_completed = [];
							ctx_upcoming = 0;
							tbl_upcoming = [];
							ctx_ongoing = 0;
							tbl_ongoing = [];
						} else {
							journeys_occuring = data.rows;
							for (var i = 0; i < journeys_occuring.length; i++) {
								if (journeys_occuring[i].journey_start_time === null && journeys_occuring[i].journey_end_time === null) {
									ctx_upcoming += 1
									tbl_upcoming.push(journeys_occuring[i])
								}
								else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time === null) {
									ctx_ongoing += 1
									tbl_ongoing.push(journeys_occuring[i])
								}
								else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time != null) {
									ctx_completed += 1
									tbl_completed.push(journeys_occuring[i])
								}
							}
						}
						pool.query(sql_query.query.all_cars, [req.user.email], (err, data) => {
							if(err || !data.rows || data.rows.length == 0) {
								ctx_cars = 0;
								cars = [];
							} else {
								ctx_cars = data.rows.length;
								cars = data.rows;
							}
							basic(req, res, 'journeys', { win: win, ctx_ongoing: ctx_ongoing, ctx_upcoming:ctx_upcoming, tbl_ongoing:tbl_ongoing, tbl_upcoming:tbl_upcoming, ctx: ctx, avg: avg, tbl: tbl, ctx_cars: ctx_cars, cars: cars, ctx_completed: ctx_completed, tbl_completed: tbl_completed, journey_msg: msg(req, 'add', 'Journey added successfully', 'Invalid parameter in journey'), auth: true });
						});
					});
				});
			}
		});
}


function update_info(req, res, next) {
	var email  = req.user.email;
	var firstname = req.body.firstname;
	var lastname  = req.body.lastname;
	pool.query(sql_query.query.update_info, [email, firstname, lastname], (err, data) => {
		if(err) {
			console.error("Error in update info");
			res.redirect('/dashboard?info=fail');
		} else {
			res.redirect('/dashboard?info=pass');
		}
	});
}

function update_pass(req, res, next) {
	var email = req.user.email;
	/*PASSWORD*/
	var password = password //bcrypt.hashSync(req.body.password, salt);
	pool.query(sql_query.query.update_pass, [email, password], (err, data) => {
		if(err) {
			console.error("Error in update pass");
			res.redirect('/dashboard?pass=fail');
		} else {
			res.redirect('/dashboard?pass=pass');
		}
	});
}

function add_car(req, res, next) {
	var email = req.user.email;
	var carplate = req.body.carplate;
	var car_model = req.body.carmodel;
	var max_pass = req.body.carmaxpass;

	pool.query(sql_query.query.add_car, [carplate, car_model, max_pass, email], (err, data) => {
		if(err) {
			console.error("Error in adding car");
			res.redirect('/cars?add=fail');
		} else {
			res.redirect('/cars?add=pass');
		}
	});
}

function add_journey(req, res, next) {
	var email = req.user.email;
	var carplate = req.body.carname.split("-")[1].trim();
	var maxPassengers = parseInt(req.body.carmaxpass);
	var pickupArea  = req.body.pickuparea;
	var dropoffArea  = req.body.dropoffarea;
	var pickuptime = req.body.pickuptime;
	var dropofftime   = req.body.dropofftime;
	var bidStart = req.body.bidstart;
	var bidEnd = req.body.bidend;
	var minBid = parseFloat(req.body.minbid);

	pool.query(sql_query.query.advertise_journey, [email, carplate, pickupArea, dropoffArea, bidStart, bidEnd, pickuptime, maxPassengers, minBid], (err, data) => {
		if(err) {
			console.error("Error in adding journey");
			res.redirect('/journeys?add=fail');
		} else {
			res.redirect('/journeys?add=pass');
		}
	});
}

function del_journey(req, res, next) {
	let carplate = req.body.journey.split(",")[0].trim()
	let pickuptime = moment(new Date(req.body.journey.split(",")[1].trim())).format('YYYY-MM-DD HH:mm:ss')

	var win = 0, avg = 0, ctx = 0, tbl, ctx_cars = 0, cars, ctx_completed = 0, tbl_completed = [], ctx_ongoing = 0, tbl_ongoing = [], ctx_upcoming = 0, tbl_upcoming = [];
	// pool.query(sql_query.query.avg_rating, [req.user.username], (err, data) => {
	// 	if(err || !data.rows || data.rows.length == 0) {
	// 		avg = 0;
	// 	} else {
	// 		avg = data.rows[0].avg;
	// 	}
		pool.query(sql_query.query.del_journey, [req.user.email, carplate, pickuptime], (err, data) => {
			if(err) {
				console.log(err)
			} else {}
			pool.query(sql_query.query.count_wins, [req.user.username], (err, data) => {
				if(err || !data.rows || data.rows.length == 0) {
					win = 0;
				} else {
					win = data.rows[0].count;
				}
				pool.query(sql_query.query.all_journeys, [req.user.email], (err, data) => {
					if(err || !data.rows || data.rows.length == 0) {
						ctx = 0;
						avg = 0;
						tbl = [];
					} else {
						ctx = data.rows.length;
						avg = win == 0 ? 0 : win/ctx;
						tbl = data.rows;
					}
					pool.query(sql_query.query.complete_journeys_driver, [req.user.email], (err, data) => {
						if(err || !data.rows || data.rows.length == 0) {
							ctx_completed = 0;
							avg = 0;
							tbl_completed = [];
							ctx_upcoming = 0;
							tbl_upcoming = [];
							ctx_ongoing = 0;
							tbl_ongoing = [];
						} else {
							journeys_occuring = data.rows;
							for (var i = 0; i < journeys_occuring.length; i++) {
								if (journeys_occuring[i].journey_start_time === null && journeys_occuring[i].journey_end_time === null) {
									ctx_upcoming += 1
									tbl_upcoming.push(journeys_occuring[i])
								}
								else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time === null) {
									ctx_ongoing += 1
									tbl_ongoing.push(journeys_occuring[i])
								}
								else if (journeys_occuring[i].journey_start_time != null && journeys_occuring[i].journey_end_time != null) {
									ctx_completed += 1
									tbl_completed.push(journeys_occuring[i])
								}
							}
						}
						pool.query(sql_query.query.all_cars, [req.user.email], (err, data) => {
							if(err || !data.rows || data.rows.length == 0) {
								ctx_cars = 0;
								cars = [];
							} else {
								ctx_cars = data.rows.length;
								cars = data.rows;
							}
							basic(req, res, 'journeys', { win: win, ctx_ongoing: ctx_ongoing, ctx_upcoming:ctx_upcoming, tbl_ongoing:tbl_ongoing, tbl_upcoming:tbl_upcoming, ctx: ctx, avg: avg, tbl: tbl, ctx_cars: ctx_cars, cars: cars, ctx_completed: ctx_completed, tbl_completed: tbl_completed, journey_msg: msg(req, 'add', 'Journey added successfully', 'Invalid parameter in journey'), auth: true });
						});
					});
				});
			});
	});
}

function add_payment(req, res, next) {
	var cardholder_name = req.body.cardholder_name;
	var cvv = req.body.cvv;
	var expiry_date = req.body.expiry_date + "/01";
	var card_number = req.body.card_number;
	var email = req.user.email;

	pool.query(sql_query.query.add_payment, ['t', cardholder_name, cvv, expiry_date, card_number, email], (err, data) => {
		console.log("OK");
		if (err) {
			console.log(err);
			res.redirect('/payment?add=fail');
		} else {
			console.log("Payment mode added.");
			res.redirect('/dashboard');
		}
	});
}

function add_driver_info(req, res, next) {
	var bank_account_no = req.body.bank_account_no;
	var license_no = req.body.license_no;
	var email = req.user.email;

	console.log(bank_account_no);
	console.log(license_no);
	console.log(email);

	pool.query(sql_query.query.add_driver_info, [bank_account_no, license_no, email], (err, data) => {
		if (err) {
			console.log(err);
			res.redirect('/driverinfo?add=fail');
		} else {
			console.log("Driver info updated.");
			res.redirect('/dashboard');
		}
	});
}


function reg_user(req, res, next) {
	var email  = req.body.email;
	/*PASSWORD*/
	var password  = req.body.password //bcrypt.hashSync(req.body.password, salt);
	var firstname = req.body.firstname;
	var lastname  = req.body.lastname;
	var dob = req.body.dob;
	console.log(req.body.user_type)
	var gender = req.body.gender === "2" ? 'f' : 'm';
	console.log(gender, dob)
	pool.query(sql_query.query.add_user, [email, dob, gender, firstname, lastname, password], (err, data) => {
		if(err) {
			console.error("Error in adding user", err);
			res.redirect('/register?reg=fail');
		} else {
			console.log(req.body.user_type)
			if (req.body.user_type == "1" || req.body.user_type == "3") {
				pool.query(sql_query.query.add_driver, [email], (err, data) => {
					if(err) {
						console.log(err)
					} else {
						console.log('Added as driver')
					}
				});
			}

			if (req.body.user_type == "2" || req.body.user_type == "3") {
				pool.query(sql_query.query.add_passenger, [email], (err, data) => {});
				//ADD DEFUALT PAYMENT METHOD AS CASH
				pool.query(sql_query.query.add_cash_payment, [email], (err, data) => {});
			}

			req.login({
				email       : email,
				passwordHash: password,
				firstname   : firstname,
				lastname    : lastname,
				dob 				: dob,
				gender			: gender
			}, function(err) {
				if(err) {
					return res.redirect('/register?reg=fail');
				} else {
					return res.redirect('/dashboard');
				}
			});
		}
	});
}

function advertisedJourneys(req, res, next) {
	basic(req, res, 'advertisedJourneys', { info_msg: msg(req, 'info', 'Information updated successfully', 'Error in updating information'), pass_msg: msg(req, 'pass', 'Password updated successfully', 'Error in updating password'), auth: true });
}

function ride_details(req, res, next) {
	var email = req.query['email'];
	var pick_up_time = req.query['pick_up_time'];
	var car_plate_no = req.query['car_plate_no'];

	var ctx, tbl;
	pool.query(sql_query.query.find_advertised_ride, [email, pick_up_time, car_plate_no], (err, data) => {
		if (err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
			var estimated_price;
		}
		pool.query(sql_query.query.estimated_price, [tbl[0].pick_up_area, tbl[0].drop_off_area], (err, data) => {
			if (err || !data.rows || data.rows.length == 0) {
				estimated_price = 0;
			} else {
				estimated_price = data.rows[0].avg_price;
			}
			if (!req.isAuthenticated()) {
				res.render('ride_details', {page: 'ride_details', auth: false, tbl: tbl, ctx: ctx});
			} else {
				basic(req, res, 'ride_details', {page: 'ride_details', auth: true, tbl:tbl, ctx: ctx, pass_msg: '', estimated_price: estimated_price});
			}
		});
	});
}

function available_rides(req, res, next) {
  var passenger_email = req.user.email;

	var tbl, ctx = 0;
	pool.query(sql_query.query.all_available_journeys, [], (err,data) => {
		if (err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		var rcmd_rides
		pool.query(sql_query.query.recommended_ride, [passenger_email], (err, data) => {
		  if (err) {
		    console.log(err);
		    rcmd_rides = []
      } else {
		    rcmd_rides = data.rows;
      }
      if (!req.isAuthenticated()) {
        res.render('available_rides', {page: 'available_rides', auth: false, tbl: tbl, ctx: ctx});
      } else {
        basic(req, res, 'available_rides', {page: 'available_rides', auth: true, tbl:tbl, ctx: ctx, rcmd_rides:rcmd_rides });
      }
    });
	});
}

function add_bid(req, res, next) {
	let passenger_email = req.user.email;
	let driver_email = req.body.driver_email;
	let car_plate_no = req.body.car_plate_no;
	let pick_up_time = req.body.pick_up_time;
	let pick_up_address = req.body.pick_up_address;
	let drop_off_address = req.body.drop_off_address;
	let bid_price = req.body.bid_price;
	let passenger_no = req.body.number_of_passengers;

	var tbl, ctx = 0;
	pool.query(sql_query.query.add_bid, [passenger_email, driver_email, car_plate_no, pick_up_time, pick_up_address,
		drop_off_address, bid_price, passenger_no], (err, data) => {
		if (err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		res.redirect('bids')
	});
}

function del_bid(req, res, next) {
	let passenger_email = req.user.email;
	let bid_details = req.body.bid_details;
	let driver_email, car_plate_no, pick_up_time;
	[driver_email, car_plate_no, pick_up_time] = bid_details.split(",");

	var tbl, ctx = 0;
	pool.query(sql_query.query.del_bid, [passenger_email, driver_email, car_plate_no, pick_up_time], (err, data) => {
		if (err) {
			console.log(err);
		} else {
			pool.query(sql_query.query.single_passenger_bids, [passenger_email], (err,data) => {
				if (err || !data.rows || data.rows.length == 0) {
					ctx = 0;
					tbl = [];
				} else {
					ctx = data.rows.length;
					tbl = data.rows;
				}
				if (!req.isAuthenticated()) {
					res.render('bids', {page: 'bids', auth: false, tbl: tbl, ctx: ctx});
				} else {
					basic(req, res, 'bids', {page: 'bids', auth: true, tbl: tbl, ctx: ctx, bid_msg: 'Bid successfully deleted'});
				}
			});
		}
	});
}

function add_upcoming_ride(req, res, next) {
	let driver_email = req.user.email;
	let ride_details = req.body.journey;
	let passenger_email, car_plate_no, pick_up_time;
	[passenger_email, car_plate_no, pick_up_time] = ride_details.split(",");
	res.redirect('/journeys');
}

// LOGOUT
function logout(req, res, next) {
	req.session.destroy()
	req.logout()
	res.redirect('/')
}

module.exports = initRouter;
