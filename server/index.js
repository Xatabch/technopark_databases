'use strict'

const Pool = require('pg').Pool;
const app = require('fastify')({
    logger: false,
});
var morgan = require('morgan');


const pool = new Pool({
    user: 'me',
    host: 'localhost',
    database: 'forum',
    password: 'postgres',
    port: 5432,
});

// app.use(morgan('dev'));

                    /* NEW TEST SECTION */
// ================================================================
async function createForumUserRelations(forumUserPairs){
    var queryString = "INSERT INTO forumusers(forum, nickname) VALUES ";

    var values = '';
    var tmp_index = 1;

    var insertionData = [];

    for (var [index1, data] of forumUserPairs.entries()){
        
        var keys = Object.keys(data);
        values += "(";
        for (var [index, key] of keys.entries()){
            values +=  "$" + (tmp_index);
            if ((index + 2) <= keys.length){
                values += ', ';            
            }
            tmp_index += 1;
            insertionData.push(data[key]);
        }

        values += ')';
        if ((index1 + 2) <= forumUserPairs.length){
            values += ', ';            
        }
    }

    queryString += values + " ON CONFLICT ON CONSTRAINT unique_forum_user_pair DO NOTHING RETURNING *";

    
    await pool.query(queryString, insertionData);
}

async function updatePostsCountBySlug(data = {}) {
    try {
        const res = pool.query(`UPDATE forums SET posts=posts + $1 WHERE slug=$2`, [data.count, data.slug]);

        return res;
    } catch (err) {
        // console.log('-------------');
        // console.log('ERROR IN updatePostsCountBySlug');
        // console.log(err);
    }
}

async function updateThreadsCountBySlug(data = {}) {
    try {
        const res = pool.query(`UPDATE forums SET threads=threads + $1 WHERE slug=$2`, [data.count, data.slug]);

        return res;
    } catch (err) {
        // console.log('-------------');
        // console.log('ERROR IN updatePostsCountBySlug');
        // console.log(err);
    }
}
// ================================================================

/* 
===CREATE USER===

POST /user/{nickname}/create

*/
async function createUser(data = {}) {
    try {
        const res = await pool.query('INSERT INTO users(about, email, fullname, nickname) VALUES($1, $2, $3, $4) RETURNING *', [data.about, data.email, data.fullname, data.nickname]);
        return res;
    } catch(err) {
        // console.log('---------------')
        // console.log('ERROR IN createUser');
        // console.log(err);
        const res = await pool.query('SELECT * FROM users WHERE email = $1 OR nickname = $2', [data.email, data.nickname]);
        throw res;
    }
}

app.post('/api/user/:nickname/create', (req, res) => {
    const about = req.body.about;
    const email = req.body.email;
    const fullname = req.body.fullname;
    const nickname = req.params.nickname;

    createUser({about, email, fullname, nickname})
    .then(result => {
        res.status(201).send(result.rows[0]);
    })
    .catch(error => {
        res.status(409).send(error.rows);
    });
});

/*
===GET USER===

GET /user/{nickname}/profile

*/
async function getUserByNickname(data = {}) {
    try {
        const res = pool.query('SELECT * FROM users WHERE nickname = $1', [data.nickname]);
        return res;
    } catch(err) {
        // console.log('---------------')
        // console.log('ERROR IN getUserByNickname');
        // console.log(err);
        throw err;
    }
}

app.get('/api/user/:nickname/profile', (req, res) => {
    const nickname = req.params.nickname;
    getUserByNickname({nickname})
    .then(result => {
        result.rowCount ? 
        res.status(200).send(result.rows[0]) :
        res.status(404).send({
            'message': `Can't find user with id #${nickname}\n`,
        });
    })
    .catch(() => {
        res.status(404).send({
            'message': `Can't find user with id #${nickname}\n`,
        });
    })
})

/*
===UPDATE USER===

POST /user/{nickname}/profile

*/

async function updateUser(data = {}) {
    let textParams = ['about', 'email', 'fullname'];
    let valuesParams = data.values;

    let textQuery = textParams.filter((_, i) => valuesParams[i])
                              .map((elem, i) => `${elem}=$${i+1}`);

    try {
        const res = await pool.query(`UPDATE users SET ${textQuery.join(',')} WHERE nickname=$${textQuery.length + 1} RETURNING *`, 
                                    [...valuesParams.filter(Boolean), data.nickname]);
        return res;
    } catch(err) {
        // console.log('---------------')
        // console.log('ERROR IN updateUser');
        // console.log(err);
        throw err;
    }
}

app.post('/api/user/:nickname/profile', (req, res) => {
    const about = req.body.about;
    const email = req.body.email;
    const fullname = req.body.fullname;
    const nickname = req.params.nickname;

    if (about || email || fullname) {
        updateUser({values: [about, email, fullname], nickname})
        .then(result => {
            result.rowCount ? 
                res.status(200).send(result.rows[0]) : 
                res.status(404).send({
                    'message': `Can't find user by nickname: ${nickname}`
                });
        })
        .catch(() => {
            res.status(409).send({
                'message': `Can't find user with id #${nickname}\n`
            })
        })
    } else {
        getUserByNickname({nickname})
        .then(result => {
            result.rowCount ? 
            res.status(200).send(result.rows[0]) :
            res.status(404).send({
                'message': `Can't find user with id #${nickname}\n`,
            });
        })
        .catch(() => {
            res.status(404).send({
                'message': `Can't find user with id #${nickname}\n`,
            });
        })
    }
})

/*
===GET FORUM===

GET /forum/{slug}/details
*/

async function getForumBySlug(data = {}) {
    try {
        const res = await pool.query('SELECT f.slug, f.title, u.nickname AS "user" FROM users AS u JOIN forums AS f ON u.nickname = f."user" WHERE f.slug=$1', [data.slug]);
        return res;
    } catch(err) {
        // console.log('---------------')
        // console.log('ERROR IN getForumBySlug');
        // console.log(err);
        throw err;
    }
}

async function getForumDetailsBySlug(data = {}) {
    try {
        const res = await pool.query(`SELECT CAST(posts AS int), CAST(threads AS INT), slug, title, u.nickname AS "user" FROM users AS u JOIN forums AS f ON u.nickname = f."user" WHERE slug=$1`, 
                                      [data.slug]);
        return res;
    } catch(err) {
        console.log('---------------')
        console.log('ERROR IN getForumDetailsBySlug');
        console.log(err);
        throw err;
    }
}

app.get('/api/forum/:slug/details', (req, res) => {
    const slug = req.params.slug;
    getForumDetailsBySlug({slug})
    .then(result => {
        result.rowCount ?
        res.status(200).send(result.rows[0]) :
        res.status(404).send({
            'message': `Can't find user with id #${slug}\n`,
        });
    })
    .catch(() => {
        res.status(404).send({
            'message': `Can't find user with id #${slug}\n`,
        });
    })
})

/*
===CREATE FORUM===

POST /forum/create
*/

async function createForum(data = {}) {
    try {
        const res = await pool.query(`INSERT INTO forums(slug, title, "user") VALUES($1, $2, $3) RETURNING slug, title, 
                                      (SELECT nickname AS "user" FROM users WHERE nickname=$3)`, 
                                      [data.slug, data.title, data.user]);
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN createForum');
        // console.log(err);
        throw err;
    }
}

app.post('/api/forum/create', (req, res) => {
    const slug = req.body.slug;
    const title = req.body.title;
    const user = req.body.user;

    createForum({slug, title, user})
    .then(result => {
        res.status(201).send(result.rows[0]);
    })
    .catch(error => {
        if (error.constraint === 'forums_user_fkey') {
            res.status(404).send({
                'message' : `Can't find user with nickname: ${user}`
            });
        } else {
            return getForumBySlug({slug});
        }
    })
    .then(result => {
        if(result) { 
            res.status(409).send(result.rows[0]);
        }
    })
})

/*
===CREATE THREAD===

POST /forum/{slug}/create
*/

async function getThread(data = {}) {
    try {
        const res = await pool.query(`SELECT t.author, t.created, f.slug AS forum, t.id, t.message, t.title ${data.params} 
                                     FROM threads AS t JOIN forums AS f ON t.forum = f.slug WHERE t.slug=$1`, 
                                     [data.slug]);
        return res;
    } catch(err) {
        // console.log('---------------')
        // console.log('ERROR IN getThread');
        // console.log(err);
        throw err;
    }
}

async function createThread(data = {}) {
    try {
        let res;
        if (data.slug) {
            res = await pool.query(`INSERT INTO threads(author, created, forum, message, slug, title) VALUES($1, $2, $3, $4, $5, $6) 
                                    RETURNING author, created, (SELECT f.slug AS forum FROM forums AS f WHERE f.slug=$3), 
                                    id, message, slug, title`, 
                                   [data.author, data.created, data.forum, data.message, data.slug, data.title]);
        } else {
            res = await pool.query(`INSERT INTO threads(author, created, forum, message, title) VALUES($1, $2, $3, $4, $5) 
                                    RETURNING author, created, (SELECT f.slug AS forum FROM forums AS f WHERE f.slug=$3), 
                                    id, message, title`, 
                                   [data.author, data.created, data.forum, data.message, data.title]);
        }

        createForumUserRelations([[data.forum, data.author]]);
        updateThreadsCountBySlug({count: res.rowCount, slug: data.forum});

        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN createThread');
        // console.log(err);
        throw err;
    }
}

app.post('/api/forum/:slug/create', (req, res) => {
    const author = req.body.author;
    const created = req.body.created;
    const forum = req.params.slug;
    const message = req.body.message;
    const title = req.body.title;
    let slug = req.body.slug;
    let params = [];

    if (req.body.slug) {
        slug = req.body.slug;
        params.push(', t.slug');
    }

    createThread({author, created, forum, message, title, slug})
    .then(result => {
        if (result.rowCount) {
            res.status(201).send(result.rows[0]);
        } else {
            res.status(404).send({
                'message': `Can't find thread author by nickname: ${author}`
            })
        }
    })
    .catch(error => {
        if (error.constraint === 'threads_slug_key') {
            return getThread({slug, params});
        } else if (error.constraint === 'threads_author_fkey') {
            res.status(404).send({
                'message': `Can't find thread author by nickname: ${author}`
            })
        } else {
            res.status(404).send({
                'message': `Can't find thread forum by slug: ${forum}`
            })
        }
    })
    .then(result => {
        if (result) {
            res.status(409).send(result.rows[0]);
        }
    })
})

/*
===GET THREADS===

GET /forum/{slug}/threads
*/

async function checkThread({slug}) {
    try {
        const res = await pool.query('SELECT * FROM threads WHERE forum=$1', [slug]);
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN checkThread');
        // console.log(err);
        throw err;
    }
}

async function getThreads(data = {}) {
    let values = [];
    let queryString = 'SELECT * FROM threads WHERE ';
    let j = 1;
    if (data.since) {
        queryString += data.desc === 'true' 
            ? `created <= $${j}::timestamptz AND created IS NOT NULL ` 
            : `created >= $${j}::timestamptz AND created IS NOT NULL `;

        values.push(data.since);
        j++;
    } else {
        queryString += `created IS NOT NULL `;
    }

    queryString += `AND forum=$${j} `;
    values.push(data.slug);
    j++;

    queryString += data.desc === 'true' 
        ? 'ORDER BY created DESC ' 
        : 'ORDER BY created ASC '

    if (data.limit) {
        queryString += `LIMIT $${j}`;
        values.push(data.limit);
    }

    try {
        const res = await pool.query(queryString, values);
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN getThreads');
        // console.log(err);
        throw err;
    }

}

app.get('/api/forum/:slug/threads', (req, res) => {
    const desc = req.query.desc;
    const limit = req.query.limit;
    const since = req.query.since;
    const slug = req.params.slug;
    
    checkThread({slug})
    .then(result => {
        if (result.rowCount) {
            return getThreads({desc, limit, since, slug});
        } else {
            res.status(404).send({
                'message': `Can't find forum with id #${slug}\n`
            });
        }
    })
    .then(result => {
        if (result) {
            res.status(200).send(result.rows);
        }
    })
    .catch(() => {
        res.status(404).send({});
    });
})

/*
===CREATE POSTS===

POST /thread/{slug_or_id}/create
*/

function constructPathString(pathArray) {
    let result = `{`;
    for (let i = 0; i < pathArray.length; i++) {
        result += pathArray[i];
        if (i !== pathArray.length - 1) {
            result += `, `;
        }
    }
    result += `}`;
    return result;
}

function getPathToPost (id) {
    return pool.query('SELECT pathtopost FROM posts WHERE id=$1', [id]);
}

async function getIdForPost() {
    try {
        const res = await pool.query("SELECT nextval('posts_id_seq')");
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN getIdForPost');
        // console.log(err);
    }
}

async function constructPathToPost(data = {}) {
    const idArray = [];
    idArray.push(data.id);
    const idString = constructPathString(idArray);

    let pathtopost;
    if (!data.parent) {
        pathtopost = data.pathtopost || idString;
    } else {
        const path = await getPathToPost(data.parent);
        path.rows[0].pathtopost.push(data.id);
        const pathString = constructPathString(path.rows[0].pathtopost);
        pathtopost = data.pathtopost || pathString || idString;
    }

    return pathtopost;
}

async function createThreads(data = {}) {
    const slug_or_id = data.slug_or_id;
    const posts = data.posts;
    const created = new Date();

    if (posts[0].parent) {
        const checkParent = await pool.query(`SELECT id FROM posts WHERE id=$1 AND thread=${+slug_or_id ? '$2' : '(SELECT id FROM threads WHERE slug=$2)'}`, 
                                             [posts[0].parent, slug_or_id]);
        if(posts[0].parent && !checkParent.rowCount) {
            return {
                error: 'conflict',
                data: checkParent.rows[0],
            }
        }
    }

    const valueValues = [];
    let test = '';
    let j = 0;

    for (let i = 0; i < posts.length; i++) {
        let value = posts[i];

        let { author, message, parent=null } = value;

        // optional parametrs
        let paramsValue = [author, message, parent]
        test += `($${j+1},$${j+2},$${j+3}`;
        j += 3;

        //created
        paramsValue.push(created);
        j++;
        test += `,$${j}`;

        // forum, thread
        if (+slug_or_id) {
            j++;
            test += `,(SELECT forum FROM threads WHERE id=$${j})`;
            j++;
            test += `,$${j}`;
        } else {
            j++;
            test += `,(SELECT forum FROM threads WHERE slug=$${j})`;
            j++;
            test += `,(SELECT id FROM threads WHERE slug=$${j})`;
        }
        paramsValue.push(slug_or_id, slug_or_id);

        //id
        const id = await getIdForPost();
        paramsValue.push(parseInt(id.rows[0].nextval, 10));

        j++;
        test += `,$${j}`;

        // pathtopost
        const path = await constructPathToPost({id: parseInt(id.rows[0].nextval, 10), parent});
        paramsValue.push(path);

        j++;
        test += `,$${j}),`;

        valueValues.push(...paramsValue);
    }

    test = test.substring(0, test.length - 1);
    try {
        const res = await pool.query(`INSERT INTO posts(author,message,parent,created,forum,thread,id,pathtopost) VALUES
                                     ${test} 
                                     RETURNING author, message, parent, id, created, forum, thread`, valueValues);

        let forumUserPairs = [];
        for(let k = 0; k < res.rows.length; k++) {
            forumUserPairs.push([res.rows[k].forum, res.rows[k].author]);
        }

        createForumUserRelations(forumUserPairs);
        updatePostsCountBySlug({count: res.rowCount, slug: res.rows[0].forum});
        
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN createPosts');
        // console.log(err);
        throw err;
    }
}

async function checkThreadForCreate(data = {}) {
    try {
        const res = await pool.query(`SELECT id FROM threads WHERE ${+data.slug_or_id ? 'id=' : 'slug='}$1`, [data.slug_or_id]);
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN checkThreadForCreate');
        // console.log(err);
    }
}

app.post('/api/thread/:slug_or_id/create', (req, res) => {
    const slug_or_id = req.params.slug_or_id;
    const posts = req.body;

    if (posts.length) {
        const author = posts[0].author;
        const message = posts[0].message;
        const parent = posts[0].parent;

        createThreads({optional: [author, message, parent], slug_or_id, posts})
        .then(result => {
            if (result.error === 'conflict') {
                res.status(409).send({
                    "message": "Parent post was created in another thread"
                  });
            } else if (result.error === 'not found') {
                res.status(404).send({
                    'message': `Can't find user with id #${slug_or_id}\n`
                  });
            }
            res.status(201).send(result.rows);
        })
        .catch(() => {
            res.status(404).send({
                'message': `Can't find user with id #${slug_or_id}\n`
            });
        })
    } else {
        checkThreadForCreate({slug_or_id})
        .then(result => {
            if(!result.rowCount) {
                res.status(404).send({
                    'message': `Can't find user with id #${slug_or_id}\n`
                });
            } else {
                res.status(201).send([]);
            }
        })
    }
})

/*
===ADD VOTE===

POST /thread/{slug_or_id}/vote

*/

async function insertVote(data = {}) {
    try {
        const isVoted = await pool.query(`SELECT * FROM votes WHERE nickname=$1 AND thread=${+data.slug_or_id ? '$2' : '(SELECT id FROM threads WHERE slug=$2)'}`, [data.nickname, data.slug_or_id]);
        if (isVoted.rowCount) {
            const vote = isVoted.rows[0].voice;
            await pool.query(`UPDATE votes SET voice=$1 WHERE nickname=$2 AND thread=${+data.slug_or_id ? '$3' : '(SELECT id FROM threads WHERE slug=$3)'}`, [data.voice, data.nickname, data.slug_or_id]);
            const updateThread = await pool.query(`UPDATE threads SET votes=votes+$1 WHERE ${+data.slug_or_id ? 'id' : 'slug'}=$2 RETURNING *`, 
                                          [data.voice - vote, data.slug_or_id]);
            return updateThread;
        } else {
            await pool.query(`INSERT INTO votes(nickname, voice, thread) VALUES($1, $2, ${+data.slug_or_id ? '$3' : '(SELECT id FROM threads WHERE slug=$3)'})`, [data.nickname, data.voice, data.slug_or_id]);
            const res = await pool.query(`UPDATE threads SET votes=votes+$1 WHERE ${+data.slug_or_id ? 'id' : 'slug'}=$2 RETURNING *`, [data.voice, data.slug_or_id]);
            return res;
        }
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN insertVote');
        // console.log(err);
        throw err;  
    }
}

app.post('/api/thread/:slug_or_id/vote', (req, res) => {
    const slug_or_id = req.params.slug_or_id;
    const nickname = req.body.nickname;
    const voice = req.body.voice;

    insertVote({slug_or_id, nickname, voice})
    .then(result => {
        res.status(200).send(result.rows[0]);
    })
    .catch(() => {
        res.status(404).send({
            'message': `Can't find thread with id #${slug_or_id}\n`,
        });
    })


})

/*
===GET THREAD===

GET /thread/{slug_or_id}/details
*/

async function getThreadDetails(data = {}) {
    try {
        const res = await pool.query(`SELECT * FROM threads WHERE ${+data.slug_or_id ? 'id' : 'slug'}=$1`, [data.slug_or_id]);
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN getThreadDetails');
        // console.log(err);
        throw err;
    }
} 

app.get('/api/thread/:slug_or_id/details', (req, res) => {
    const slug_or_id = req.params.slug_or_id;
    getThreadDetails({slug_or_id})
    .then(result => {
        if (!result.rowCount) {
            res.status(404).send({
                'message': `Can't find user with id #${slug_or_id}\n`
            })
        }
        res.status(200).send(result.rows[0]);
    })
    .catch(() => {
        res.status(404).send({
            'message': `Can't find user with id #${slug_or_id}\n`
        })
    })
})

/*
===GET POSTS===

GET /thread/{slug_or_id}/posts
*/

async function flatSort(data = {}) {
    try {
        const isThread = await pool.query(`SELECT id FROM threads WHERE id=${+data.slug_or_id ? '$1' : '(SELECT id FROM threads WHERE slug=$1)'}`, [data.slug_or_id]);
        if (!isThread.rowCount) {
            return {
                error: 'noThread',
            }
        }
        if (data.since) {
            if (data.desc) {
                const res = await pool.query(`SELECT * FROM posts WHERE thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} AND id < $2 ORDER BY "created" DESC, id DESC LIMIT $3`,
                                      [data.slug_or_id, data.since, data.limit]);
                return res;
            } else {
                const res = await pool.query(`SELECT * FROM posts WHERE thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} AND id > $2 ORDER BY "created" ASC, id ASC LIMIT $3`,
                                            [data.slug_or_id, data.since, data.limit]);
                return res;
            }
        } else {
            if (data.desc) {
                const res = await pool.query(`SELECT * FROM posts WHERE thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} ORDER BY "created" DESC, id DESC LIMIT $2`, 
                                            [data.slug_or_id, data.limit]);
                return res;
            } else {
                const res = await pool.query(`SELECT * FROM posts WHERE thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} ORDER BY "created" ASC, id ASC LIMIT $2`, 
                                            [ data.slug_or_id, data.limit ]);
                return res;
            }
        }
    } catch (err) {
        // console.log('---------------');
        // console.log('ERROR IN flatSort');
        // console.log(err);
        throw err;
    }
}

async function treeSort(data = {}) {
    try {
        const isThread = await pool.query(`SELECT id FROM threads WHERE id=${+data.slug_or_id ? '$1' : '(SELECT id FROM threads WHERE slug=$1)'}`, [data.slug_or_id]);
        if (!isThread.rowCount) {
            return {
                error: 'noThread',
            }
        }
        if (data.since && !data.desc) {
            const res = await pool.query(`SELECT * FROM posts
                                         WHERE thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} 
                                         AND pathtopost > (SELECT pathtopost FROM posts WHERE id=$2)
                                         ORDER BY ${data.desc ? 'pathtopost DESC' : 'pathtopost ASC'} LIMIT $3`,
                                         [ data.slug_or_id, data.since, data.limit ]);
            return res;
        } else if (data.since && data.desc) {
            const res = await pool.query(`SELECT * FROM posts
                                         WHERE thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`}
                                         AND pathtopost < (SELECT pathtopost FROM posts WHERE id=$2)
                                         ORDER BY ${data.desc ? 'pathtopost DESC' : 'pathtopost ASC'} LIMIT $3`,
                                         [ data.slug_or_id, data.since, data.limit ]);
            return res;
        } else if (!data.since) {
            const res = await pool.query(`SELECT * FROM posts
                                         WHERE thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`}
                                         ORDER BY ${data.desc ? 'pathtopost DESC' : 'pathtopost ASC'}  LIMIT $2`,
                                         [ data.slug_or_id, data.limit ]); 
            return res;  
        }
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN treeSort');
        // console.log(err);
    }
}

async function parentTreeSort(data = {}) {
    try {
        const isThread = await pool.query(`SELECT id FROM threads WHERE id=${+data.slug_or_id ? '$1' : '(SELECT id FROM threads WHERE slug=$1)'}`, [data.slug_or_id]);
        if (!isThread.rowCount) {
            return {
                error: 'noThread',
            }
        }
        if (data.since && !data.desc) {
            const res = await pool.query(
            `SELECT * FROM posts
                JOIN (
                    SELECT id AS parent_id FROM posts WHERE parent IS NULL AND thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} 
                    AND pathtopost[1] > (SELECT pathtopost[1] FROM posts WHERE id=$2)
                    ORDER BY ${data.desc ? 'id DESC' : 'id ASC'} LIMIT $3
                ) AS pid
                ON (thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`}  
                AND pid.parent_id=pathtopost[1])
                ORDER BY ${data.desc ? 'pid.parent_id DESC, pathtopost ASC' : 'pathtopost ASC'}
                `,
                [
                    data.slug_or_id,
                    data.since,
                    data.limit,
                ]
            );

            return res;
        } else if (data.since && data.desc) {
            const res = await pool.query(
                `SELECT * FROM posts
                JOIN (
                    SELECT id AS parent_id FROM posts WHERE parent IS NULL AND thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} 
                    AND pathtopost[1] < (SELECT pathtopost[1] FROM posts WHERE id=$2)
                    ORDER BY ${data.desc ? 'id DESC' : 'id ASC'} LIMIT $3
                ) AS pid
                ON (thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} AND pid.parent_id=pathtopost[1])
                ORDER BY ${data.desc ? 'pid.parent_id DESC, pathtopost ASC' : 'pathtopost ASC'}
                `,
                [
                    data.slug_or_id,
                    data.since,
                    data.limit,
                ]
            );

            return res;
        } else if (!data.since) { 
            const res = await pool.query(
                `SELECT * FROM posts
                JOIN (
                    SELECT id AS parent_id FROM posts WHERE parent IS NULL AND thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} 
                    ORDER BY ${data.desc ? 'id DESC' : 'id ASC'} LIMIT $2
                ) AS pid
                ON (thread=${+data.slug_or_id ? '$1' : `(SELECT id FROM threads WHERE slug=$1)`} AND pid.parent_id=pathtopost[1])
                ORDER BY ${data.desc ? 'pid.parent_id DESC, pathtopost ASC' : 'pathtopost ASC'}
                `,
                [
                    data.slug_or_id,
                    data.limit,
                ]
            );

            return res;
        }
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN parentSort');
        // console.log(err);
    }
}

app.get('/api/thread/:slug_or_id/posts', (req, res) => {
    let desc = req.query.desc;
    let limit = req.query.limit;
    let since = req.query.since;
    let sort = req.query.sort;
    let slug_or_id = req.params.slug_or_id;

    if (!limit) {
        limit = 10;
    }

    desc = desc === 'true';
    since = parseInt(since, 10) ? parseInt(since, 10) : null;

    if (sort === 'flat' || !sort) {
        flatSort({desc, limit, since, slug_or_id})
        .then(result => {
            if(result.error) {
                res.status(404).send({
                    'message': `Can't find thread by slug: ${slug_or_id}`
                });
            }
            res.status(200).send(result.rows);
        })
        .catch(() => {
            res.status(404).send([]);
        })
    } else if (sort === 'tree') {
        treeSort({desc, limit, since, slug_or_id})
        .then(result => {
            if(result.error) {
                res.status(404).send({
                    'message': `Can't find thread by slug: ${slug_or_id}`
                });
            }
            res.status(200).send(result.rows);
        })
    } else if (sort === 'parent_tree') {
        parentTreeSort({desc, limit, since, slug_or_id})
        .then(result => {
            if(result.error) {
                res.status(404).send({
                    'message': `Can't find thread by slug: ${slug_or_id}`
                });
            }
            res.status(200).send(result.rows);
        })
    } else {
        res.status(404).send({
            'message': `Can't find thread by slug: ${slug_or_id}`
        });
    }
})

/*
===UPDATE THREAD===

POST /thread/{slug_or_id}/details
*/

async function updateThread(data = {}) {
    let textParams = ['message', 'title'];
    let valuesParams = data.values;

    let textQuery = textParams.filter((_, i) => valuesParams[i])
                              .map((elem, i) => `${elem}=$${i+1}`);

    try {
        if (!valuesParams.filter(Boolean).length) {
            const res = await pool.query(`SELECT * FROM threads WHERE ${+data.slug_or_id ? 'id' : 'slug'}=$1`, [data.slug_or_id]);
            return res;
        }

        const res = await pool.query(`UPDATE threads SET ${textQuery.join(',')} WHERE ${+data.slug_or_id ? 'id' : 'slug'}=$${textQuery.length+1} RETURNING *`, 
                                    [...valuesParams.filter(Boolean), data.slug_or_id]);
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN updateThread');
        // console.log(err);
        throw err;
    }
}

app.post('/api/thread/:slug_or_id/details', (req, res) => {
    const slug_or_id = req.params.slug_or_id;
    const message = req.body.message;
    const title = req.body.title;

    updateThread({values: [message, title], slug_or_id})
    .then(result => {
        result.rowCount ? 
                res.status(200).send(result.rows[0]) : 
                res.status(404).send({
                    'message': `Can't find user by nickname: ${slug_or_id}`
                });
    })
    .catch(() => {
        res.status(409).send({
            'message': `Can't find user with id #${slug_or_id}\n`
        })
    })
});

/*
===GET FORUM USERS===

GET /api/forum/:slug/users
*/

async function checkForum(data = {}) {
    try {
        const res = await pool.query('SELECT * FROM forums WHERE slug=$1', [data.slug]);
        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN checkForum');
        // console.log(err);
        throw err;
    }
}

async function getForumUsers(data = {}) {
    try {
        let res;
        if (data.since) {
            res = await pool.query(`SELECT * FROM users AS U RIGHT OUTER JOIN forumusers AS FU
                                    ON FU.nickname = U.nickname
                                    WHERE FU.forum=$1 AND ${data.desc ? 'U.nickname < $2' : 'U.nickname > $2'} 
                                    ORDER BY ${data.desc ? 'FU.nickname DESC' : 'FU.nickname ASC'} LIMIT $3`,
                                    [data.slug, data.since, data.limit]);
        } else {
            res = pool.query(`SELECT * FROM users AS U RIGHT OUTER JOIN forumusers AS FU
                              ON FU.nickname = U.nickname
                              WHERE FU.forum=$1 ORDER BY ${data.desc ? 'FU.nickname DESC' : 'FU.nickname ASC'} LIMIT $2`, 
                              [data.slug, data.limit]);
        }

        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN getUsers');
        // console.log(err);
        throw err;
    }
}

app.get('/api/forum/:slug/users', (req, res) => {
    let desc = req.query.desc;
    let limit = req.query.limit;
    let since = req.query.since;
    const slug = req.params.slug;

    desc = desc === 'true';
    limit = limit ? limit : 10;
    since = since ? since : null;

    checkForum({slug})
    .then(result => {
        if (result.rowCount) {
            return getForumUsers({desc, limit, since, slug});
        } else {
            res.status(404).send({
                'message': 'Can\'t find user with id #${slug}\n'
              })
        }
    })
    .then(result => {
        res.status(200).send(result.rows);
    })
    .catch(() => {
        res.status(404).send({})})
})

/*
===GET POST DETAILS===

GET /post/{id}/details
*/
// ${data.forum_param ? ', f.posts::int AS forum_posts, f.slug AS forum_slug, f.threads::int AS forum_threads, f.slug AS forum_slug, f.title AS forum_title, f.user AS forum_user' : ''}
// ${data.forum_param ? 'JOIN forums AS f ON p.forum=f.slug' : ''}
async function getPostDetail(data = {}) {
    try {
        const res = await pool.query(`SELECT p.author, p.created, p.forum, p.id, p.isEdited, p.message, p.parent, p.thread 
                                      ${data.user_param ? ', u.nickname, u.fullname, u.email, u.about' : ''}
                                      ${data.thread_param ? ', t.author AS thread_author, t.created AS thread_created, t.forum AS thread_forum, t.id AS thread_id, t.message AS thread_message, t.slug AS thread_slug, t.title AS thread_title, t.votes AS thread_votes' : ''}
                                       FROM posts AS p
                                      ${data.user_param ? ' JOIN users AS u ON p.author=u.nickname' : ''} 
                                      ${data.thread_param ? ' JOIN threads AS t ON p.thread=t.id' : ''}
                                       WHERE p.id=$1`, [data.id]);
        if (res.rowCount && data.forum_param) {
            const forum = await pool.query(`SELECT posts::int, threads::int, slug, title, u.nickname AS "user" FROM users AS u JOIN forums AS f ON u.nickname = f."user" WHERE slug=$1`, 
                                            [res.rows[0].forum]);
            res.rows[0].forum_posts = forum.rows[0].posts;
            res.rows[0].forum_threads = forum.rows[0].threads;
            res.rows[0].forum_slug = forum.rows[0].slug;
            res.rows[0].forum_title = forum.rows[0].title;
            res.rows[0].forum_user = forum.rows[0].user;
        }
        
        return res;
    } catch(err) {
        console.log('---------------');
        console.log('ERROR IN getPostDetail');
        console.log(err);
    }

}

app.get('/api/post/:id/details', (req, res) => {
    let user_param = null;
    let thread_param = null;
    let forum_param = null;
    let related = req.query.related;
    if (related) {
        let params = related.split(',');
        user_param = params[params.indexOf('user')];
        thread_param = params[params.indexOf('thread')];
        forum_param = params[params.indexOf('forum')];
    }
    const id = req.params.id;

    getPostDetail({id, user_param, thread_param, forum_param})
    .then(result => {
        if (result.rowCount) { 
            let { author, created, forum, id, isedited, message, parent, thread,
                nickname, fullname, email, about, thread_author, 
                thread_created, thread_forum, thread_id, 
                thread_message, thread_slug, thread_title, thread_votes,
                forum_posts, forum_slug, forum_threads, forum_title, forum_user } = result.rows[0];

            let response = {
                'post' : {
                    'author': author,
                    'created' : created,
                    'forum': forum,
                    'id': id,
                    'isEdited': isedited,
                    'message': message,
                    'parent' : parent,
                    'thread': thread,
            }}

            if (user_param) {
                response['author'] = {};
                response['author']['nickname'] = nickname;
                response['author']['fullname'] = fullname;
                response['author']['email'] = email;
                response['author']['about'] = about;
            }

            if (thread_param) {
                response['thread'] = {};
                response['thread']['author'] = thread_author;
                response['thread']['created'] = thread_created;
                response['thread']['forum'] = thread_forum;
                response['thread']['id'] = thread_id;
                response['thread']['message'] = thread_message;
                response['thread']['slug'] = thread_slug;
                response['thread']['title'] = thread_title;
                response['thread']['votes'] = thread_votes;
            }

            if (forum_param) {
                response['forum'] = {};
                response['forum']['posts'] = forum_posts;
                response['forum']['slug'] = forum_slug;
                response['forum']['threads'] = forum_threads;
                response['forum']['title'] = forum_title;
                response['forum']['user'] = forum_user;
            }

            res.status(200).send(response);
        } else {
            res.status(404).send({
                'message': `Can't find user with id #${id}\n`
              })
        }
    })
    .catch(() => {
        // console.log('---------------');
        // console.log('ERROR IN getPostDetails')
        // console.log(error);
    })
});

/*
===UPDATE POST MESSAGE===

POST /post/{id}/details
*/

async function updatePostMessage(data = {}) {
    try {
        let res;
        if (data.message) {
            const message = await pool.query(`SELECT author, created, forum, id, isEdited, message, parent, thread FROM posts WHERE id=$1`,
                                             [data.id]);
            if (message.rowCount && data.message !== message.rows[0].message) { 
                res = await pool.query(`UPDATE posts SET message=$1, isEdited=true WHERE id=$2 
                                            RETURNING author, created, forum, id, isEdited, message, parent, thread`,
                                            [data.message, data.id]);
            } else {
                return message;
            }
        } else {
            res = await pool.query(`SELECT author, created, forum, id, isEdited, message, parent, thread FROM posts WHERE id=$1`,
                                        [data.id]);
        }

        return res;
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN updatePostMessage');
        // console.log(err);
    }
} 

app.post('/api/post/:id/details', (req, res) => {
    const id = req.params.id;
    const message_param = req.body.message || null;

    updatePostMessage({id, message: message_param})
    .then(result => {
        if (result.rowCount) {
            let { author, created, forum, id, isedited, message, thread } = result.rows[0];
            let response = {
                'author': author,
                'created' : created,
                'forum': forum,
                'id': id,
                'message': message,
                'thread': thread,
            } 

            if (message || message_param != message) {
                response['isEdited'] = isedited;
            }
            
            res.status(200).send(response);
        } else {
            res.status(404).send({
                'message': `Can't find user with id #${id}\n`
            });
        }
    })
    .catch(() => {
        // console.log('---------------');
        // console.log('ERROR IN updatePostMessage');
        // console.log(err);
    })
})

/*
===GET SERVICE STATUS===

GET service/status
*/

async function getServiceStatus() {
    try {
        const forums = await pool.query(`SELECT COUNT(*) FROM forums`);
        const posts = await pool.query(`SELECT COUNT(*) FROM posts`);
        const threads = await pool.query(`SELECT COUNT(*) FROM threads`);
        const users = await pool.query(`SELECT COUNT(*) FROM users`);

        return {
            forums: forums.rows[0].count,
            posts: posts.rows[0].count,
            threads: threads.rows[0].count,
            users: users.rows[0].count,
        };
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN getServiceStatus');
        // console.log(err);
    }
}

app.get('/api/service/status', (req, res) => {
    getServiceStatus()
    .then(result => {
        res.status(200).send({
            'forum': +result.forums,
            'post': +result.posts,
            'thread': +result.threads,
            'user': +result.users,
        })
    })
})

/*
===CLEAR DB===

POST /service/clear
*/

async function clearService() {
    try {
        await pool.query('DELETE FROM posts');
        await pool.query('DELETE FROM votes');
        await pool.query('DELETE FROM threads');
        await pool.query('DELETE FROM forums');
        await pool.query('DELETE FROM users');

        return {};
    } catch(err) {
        // console.log('---------------');
        // console.log('ERROR IN clearService');
        // console.log(err);
    }
}

app.addContentTypeParser('application/json', { parseAs: 'string' }, function(request, body, done) {
    try {
        let json = JSON.parse(body);
        done(null, json);
    } catch(err) {
        done(null, undefined);
    } 
});

app.post('/api/service/clear', (req, res) => {
    clearService()
    .then(() => {
        res.status(200).send(null);
    })
})


const port = process.env.PORT || 5000;

app.listen(port, '0.0.0.0',(err,address) => {
	console.log(`Server listening on port ${port}`);
});