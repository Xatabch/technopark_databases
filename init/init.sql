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
    posts    BIGINT        NOT NULL DEFAULT 0,
    threads  INT           NOT NULL DEFAULT 0
);

CREATE UNLOGGED TABLE threads (
    id       SERIAL         PRIMARY KEY, 
    author   CITEXT         REFERENCES users(nickname), 
    created  TIMESTAMP, 
    forum    CITEXT         REFERENCES forums(slug) NOT NULL, 
    message  TEXT, 
    slug     CITEXT         UNIQUE, 
    title    VARCHAR(100), 
    votes    INT            DEFAULT 0
);

CREATE UNLOGGED SEQUENCE IF NOT EXISTS posts_id_seq;

CREATE UNLOGGED TABLE posts (
    id          SERIAL      PRIMARY KEY, 
    author      CITEXT      REFERENCES users(nickname), 
    created     TIMESTAMP   DEFAULT NOW(), 
    forum       CITEXT      REFERENCES forums(slug), 
    isEdited    BOOLEAN     DEFAULT false, 
    message     TEXT, 
    parent      INT         DEFAULT NULL, 
    thread      INT         REFERENCES threads(id),
    pathtopost  INT         ARRAY
);

ALTER SEQUENCE posts_id_seq OWNED BY posts.id;

CREATE UNLOGGED TABLE votes (
    nickname CITEXT REFERENCES users(nickname) NOT NULL, 
    voice    INT                               NOT NULL, 
    thread   INT    REFERENCES threads(id)     NOT NULL
);


CREATE INDEX IF NOT EXISTS nickname_thread_index ON votes(nickname, thread);

CREATE INDEX IF NOT EXISTS thread_id_index ON posts(thread, id);