CREATE EXTENSION IF NOT EXISTS CITEXT;

CREATE UNLOGGED TABLE users (
    nickname CITEXT PRIMARY KEY,
    about TEXT, 
    email CITEXT UNIQUE, 
    fullname VARCHAR(100)
);

CREATE UNLOGGED TABLE forums (
    slug     CITEXT        PRIMARY KEY, 
    title    VARCHAR(100) NOT NULL, 
    "user"   CITEXT        REFERENCES users(nickname) NOT NULL,
    posts    BIGINT        DEFAULT 0,
    threads  BIGINT        DEFAULT 0
);

CREATE UNLOGGED TABLE threads (
    id       SERIAL         PRIMARY KEY, 
    author   CITEXT         REFERENCES users(nickname), 
    created  TIMESTAMP WITH TIME ZONE, 
    forum    CITEXT         REFERENCES forums(slug) NOT NULL, 
    message  TEXT, 
    slug     CITEXT         UNIQUE, 
    title    VARCHAR(100), 
    votes    INT            DEFAULT 0
);

CREATE SEQUENCE IF NOT EXISTS posts_id_seq START 1;

CREATE UNLOGGED TABLE posts (
    id          SERIAL      PRIMARY KEY, 
    author      CITEXT      REFERENCES users(nickname), 
    created     TIMESTAMP WITH TIME ZONE   DEFAULT NOW(), 
    forum       CITEXT      REFERENCES forums(slug), 
    isEdited    BOOLEAN     DEFAULT false, 
    message     TEXT, 
    parent      INT         DEFAULT NULL, 
    thread      INT         NOT NULL REFERENCES threads(id),
    pathtopost  INT         ARRAY
);

ALTER SEQUENCE posts_id_seq OWNED BY posts.id;

CREATE UNLOGGED TABLE votes (
    nickname CITEXT REFERENCES users(nickname) NOT NULL, 
    voice    INT                               NOT NULL, 
    thread   INT    REFERENCES threads(id)     NOT NULL
);


CREATE UNLOGGED TABLE IF NOT EXISTS forumusers (
	forum            CITEXT       NOT NULL,
	nickname         CITEXT       NOT NULL
);

ALTER TABLE forumusers
ADD CONSTRAINT unique_forum_user_pair UNIQUE (forum, nickname);

CREATE INDEX IF NOT EXISTS nickname_thread_index ON votes(nickname, thread);

CREATE INDEX IF NOT EXISTS thread_id_index ON posts(id, thread);

CREATE INDEX IF NOT EXISTS posts_forum ON posts(forum);

CREATE INDEX post_author ON posts(author);

CREATE INDEX post_thread ON posts(thread);

CREATE INDEX IF NOT EXISTS email_users_index ON users(email);

CREATE INDEX IF NOT EXISTS user_forums_index ON forums("user");

CREATE INDEX IF NOT EXISTS created_forum_index ON threads(forum, created);

CREATE INDEX IF NOT EXISTS forum_index ON threads(forum);

CREATE INDEX IF NOT EXISTS posts_pathtopost_thread_index ON posts(thread, pathtopost);

CREATE INDEX IF NOT EXISTS posts_parent_thread_index ON posts(parent, thread);