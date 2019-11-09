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

	//app.get('/rides', passport.authMiddleware(), rides);

	app.get('/register' , passport.antiMiddleware(), register );
	app.get('/login'		, passport.antiMiddleware(), login);
	app.get('/password' , passport.antiMiddleware(), retrieve );

	/* PROTECTED POST */
	app.post('/update_info', passport.authMiddleware(), update_info);
	app.post('/update_pass', passport.authMiddleware(), update_pass);
	app.post('/add_car'    , passport.authMiddleware(), add_car);
	app.post('/add_journey', passport.authMiddleware(), add_journey);
	app.post('/del_car'    , passport.authMiddleware(), del_car);
	app.post('/del_journey', passport.authMiddleware(), del_journey);
	app.post('/add_bid', passport.authMiddleware(), add_bid);

	app.post('/reg_user'   , passport.antiMiddleware(), reg_user);

	app.post('/add_payment', passport.authMiddleware(), add_payment);
	app.post('/add_driver_info', passport.authMiddleware(), add_driver_info);

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
	basic(req, res, 'bids', { info_msg: msg(req, 'info', 'Information updated successfully', 'Error in updating information'), pass_msg: msg(req, 'pass', 'Password updated successfully', 'Error in updating password'), auth: true });
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
	basic(req, res, 'dashboard', { info_msg: msg(req, 'info', 'Information updated successfully', 'Error in updating information'), pass_msg: msg(req, 'pass', 'Password updated successfully', 'Error in updating password'), auth: true });
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
	var win = 0, avg = 0, ctx = 0, tbl, ctx_cars = 0, cars, ctx_completed = 0, tbl_completed;
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
				} else {
					ctx_completed = data.rows.length;
					tbl_completed = data.rows;
				}
				pool.query(sql_query.query.all_cars, [req.user.email], (err, data) => {
					if(err || !data.rows || data.rows.length == 0) {
						ctx_cars = 0;
						cars = [];
					} else {
						ctx_cars = data.rows.length;
						cars = data.rows;
					}
					basic(req, res, 'journeys', { win: win, ctx: ctx, avg: avg, tbl: tbl, ctx_cars: ctx_cars, cars: cars, ctx_completed: ctx_completed, tbl_completed: tbl_completed, journey_msg: msg(req, 'add', 'Journey added successfully', 'Invalid parameter in journey'), auth: true });
				});
			});
		});
	});
}

function register(req, res, next) {
	res.render('register', { page: 'register', auth: false });
}
function retrieve(req, res, next) {
	res.render('retrieve', { page: 'retrieve', auth: false });
}


// POST
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
	let pickuptime = req.body.journey.split(",")[1].trim().replace("T", " ").replace("Z", "").split(".")[0]

	var ctx = 0, avg = 0, tbl = [], ctx_cars = 0, cars=[];
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
				pool.query(sql_query.query.all_journeys, [req.user.email], (err, data) => {
					if(err || !data.rows || data.rows.length == 0) {
						ctx = 0;
						avg = 0;
						tbl = [];
					} else {
						ctx = data.rows.length;
						tbl = data.rows;
					}
					pool.query(sql_query.query.all_cars, [req.user.email], (err, data) => {
						if(err || !data.rows || data.rows.length == 0) {
							ctx_cars = 0;
							cars = [];
						} else {
							ctx_cars = data.rows.length;
							cars = data.rows;
						}
						basic(req, res, 'journeys', {ctx: ctx, avg: avg, tbl: tbl, ctx_cars: ctx_cars, cars: cars, journey_msg: msg(req, 'add', 'Journey added successfully', 'Invalid parameter in journey'), auth: true });
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

	pool.query(sql_query.query.find_advertised_ride, [email, pick_up_time, car_plate_no], (err, data) => {
		if (err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		if (!req.isAuthenticated()) {
			res.render('ride_details', {page: 'ride_details', auth: false, tbl: tbl, ctx: ctx});
		} else {
			basic(req, res, 'ride_details', {page: 'ride_details', auth: true, tbl:tbl, ctx: ctx, pass_msg: ''});
		}
	});
}

function available_rides(req, res, next) {
	var tbl, ctx = 0;
	pool.query(sql_query.query.all_available_journeys, [], (err,data) => {
		if (err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		if (!req.isAuthenticated()) {
			res.render('available_rides', {page: 'available_rides', auth: false, tbl: tbl, ctx: ctx});
		} else {
			basic(req, res, 'available_rides', {page: 'available_rides', auth: true, tbl:tbl, ctx: ctx});
		}
	});
}

function add_bid(req, res, next) {
	let passenger_email = req.user.email;
	let driver_email = req.body.driver_email;
	let car_plate_no = req.body.car_plate_no;
	let pick_up_time = req.body.pick_up_time;
	let pick_up_address = req.body.pick_up_address;
	let drop_off_address = req.body.drop_off_address;
	let bid_time = (new Date()).toISOString().slice(0, 19).replace('T', ' ');
	let bid_price = req.body.bid_price;
	let passenger_no = req.body.number_of_passengers;

	var tbl, ctx = 0;
	pool.query(sql_query.query.add_bid, [passenger_email, driver_email, car_plate_no, pick_up_time, pick_up_address,
		drop_off_address, bid_time, bid_price, passenger_no], (err, data) => {
		if (err || !data.rows || data.rows.length == 0) {
			ctx = 0;
			tbl = [];
		} else {
			ctx = data.rows.length;
			tbl = data.rows;
		}
		if (!req.isAuthenticated()) {
			res.render('available_rides', {page: 'available_rides', auth: false, tbl: tbl, ctx: ctx});
		} else {
			basic(req, res, 'available_rides', {page: 'available_rides', auth: true, tbl:tbl, ctx: ctx});
		}
	});

}


// LOGOUT
function logout(req, res, next) {
	req.session.destroy()
	req.logout()
	res.redirect('/')
}

module.exports = initRouter;
