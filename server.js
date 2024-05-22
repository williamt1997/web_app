const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 4566;
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

const publicDirectoryPath = __dirname;
app.use(express.static(publicDirectoryPath));


const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'thorpe01685',
    port: 5433, 
});

app.post('/register', async (req, res) => {
    try{
        const { user_username, user_email, user_profilepicture, user_password } = req.body;
        const emailCheckQuery = 'SELECT * FROM public."user" WHERE user_email = $1';
        const emailCheckResult = await pool.query(emailCheckQuery, [user_email]);
        if (emailCheckResult.rows.length > 0) {
            return res.redirect('/?message=EmailExists');
        }

        const hashed_password = await bcrypt.hash(user_password, 10);
        await pool.query('INSERT INTO public."user" ( user_email, user_username, user_profilepicture, user_password ) VALUES ($2, $1, $3, $4)', [user_username, user_email, user_profilepicture, hashed_password]);
        return res.redirect('/?message=UserSuccessfullyAdded');
    }
    catch(err){
        console.log(res, "\n\n", err)
        return res.redirect('/?message=ServerError');
    }
});


app.post('/login', async (req, res) => {
    try{
        const { user_email, user_password } = req.body;
        const logcheck = await pool.query('SELECT * FROM public."user" WHERE user_email = $1', [user_email]);
        const user = logcheck.rows[0];

        if (user && await bcrypt.compare(user_password, user.user_password)){
            const tokenPayload = {
                user_email: user.user_email,
                user_username: user.user_username,
                user_id: user.user_id,
                user_profilepicture: user.user_profilepicture
            };
            const token = jwt.sign(tokenPayload, "b4d0fd9c20832727c41b8c599dedef1c187cddcd53b4db50fdb1ae5d84db38f5", { expiresIn: '1h' });
            res.cookie('token', token);
            res.redirect('/body')
        } else {
            return res.redirect('/?message=InvalidCred');
        }
        
    }
    catch(err){
        console.log(res, "\n\n", err)
        return res.redirect('/?message=ServerErrorLog');
    }
});

app.listen(port, () => {
    console.log(`Server running Via: ${port}`)
})

function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    console.log(token)

    if (token == null) {
        return res.redirect('/');
    }

    jwt.verify(token, 'b4d0fd9c20832727c41b8c599dedef1c187cddcd53b4db50fdb1ae5d84db38f5', (err, user) => {
        if (err) {
            return res.sendStatus(403); // Token is invalid
        }
        req.user = user;
        next();
    });
}
  app.get('/body', authenticateToken, (req, res) => {
        res.sendFile(path.join(__dirname, 'body.html'));
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
        res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
        res.setHeader('Expires', '0');
  });

  app.get('/api/media', authenticateToken, (req, res) => {
    const genre = req.query.genre.toLowerCase();
    let query = 'SELECT * FROM public."media"';
    const values = [];

    if (genre){
        query += ' WHERE media_genre ILIKE $1 OR media_name ILIKE $1 OR media_writer ILIKE $1';
        values.push(`%${genre}%`);
    }

    pool.query(query, values, (error, results) => {
        if (error) {
            return res.status(500).send("Error occurred during database query");
        }
        res.json(results.rows);
    });
});

app.get('/user', authenticateToken, (req, res) => {
    res.json({ username: req.user.user_username });
});

app.post('/logout', (req, res) => {
    res.clearCookie('token');
    return res.redirect('/body');
});

app.get('/review', authenticateToken, (req, res) => {
    const media_id = req.cookies.media_id;
    res.sendFile(path.join(__dirname, 'review.html'));
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
    res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
    res.setHeader('Expires', '0');
});

app.post('/review', authenticateToken, (req, res) => {
    const { media_id } = req.body;
    res.cookie('media_id', media_id, { httpOnly: true });
    return res.redirect('/review');
});

app.get('/api/review', authenticateToken, (req, res) => {
    let media_id  = req.cookies.media_id;
    let query = `SELECT * FROM public."media" WHERE media_id = '${media_id}'`;
    pool.query(query, (error, results) => {
        if (error) {
            return res.status(500).send("Error occurred during database query");
        }
        res.json(results.rows);
    });
});

app.post('/createreview', authenticateToken, async (req, res) => {
    try{
        let user_id = req.user.user_id;
        let media_id  = req.cookies.media_id;
        const { review_title, review_body, review_rating } = req.body;
        const nospamreviewQuery = `SELECT * FROM public."review" WHERE user_id = $1 AND media_id = $2`;
        const nospamreviewResult = await pool.query(nospamreviewQuery, [user_id, media_id]);
        if (nospamreviewResult.rows.length > 0) {
            return res.redirect('/review?message=ReviewExists');
        }
        await pool.query('INSERT INTO public."review" ( user_id, media_id, review_title, review_body, review_rating ) VALUES($1, $2, $3, $4, $5)', [user_id, media_id, review_title, review_body, review_rating]);
        return res.redirect('/review?message=ReviewSuccessfullyAdded');
    }
    catch(err){
        console.log(res, "\n\n", err)
        return res.redirect('/review?message=ReviewServerError');
    }
});

app.get('/api/reviewcontent', authenticateToken, (req, res) => {
    let media_id  = req.cookies.media_id;
    let query = `SELECT * FROM public."review" WHERE media_id = '${media_id}'`;
    pool.query(query, (error, results) => {
        if (error) {
            return res.status(500).send("Error occurred during database query");
        }
        res.json(results.rows);
    });
});

app.get('/api/average_review', authenticateToken, (req, res) => {
    let mediaId = req.query.mediaId;
    let query = `SELECT * FROM public."review" WHERE media_id = '${mediaId}'`;
    pool.query(query, (error, results) => {
        if (error) {
            return res.status(500).send("Error occurred during database query");
        }
        res.json(results.rows);
    });
});

app.get('/api/review_author', (req, res) => {
    let user_id = req.query.user_id;
    let query = `SELECT * FROM public."user" WHERE user_id = '${user_id}'`;
    pool.query(query, (error, results) => {
        if (error) {
            return res.status(500).send("Error occurred during database query");
        }
        res.json(results.rows);
    });
});

app.get('/api/reviewrecent', (req, res) => {
    let query = `SELECT * FROM public."review" ORDER BY review_id DESC LIMIT 5`;
    pool.query(query, (error, results) => {
        if (error) {
            return res.status(500).send("Error occurred during database query");
        }
        res.json(results.rows);
    });
});

app.post('/backtomedia', (req, res) => {
    return res.redirect('/body');
});




