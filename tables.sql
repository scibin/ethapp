-- Table of users list and important/sensitive information
create table users (
    email varchar(128),
    password varchar(128) not null,
    first_name varchar(32) not null,
    last_name varchar(64) not null,
    email_confirmed tinyint,
    date_acc_created datetime default current_timestamp,
    g2fasc varchar(128),
    primary key(email)
)

-- List of ethereum accounts tied to each user account through his/her email
create table ethacc (
	email varchar(128),
    ethaddress char(42),
    ethpk char(66),
    primary key(email),
    
    constraint fk_emailforethacc
		foreign key(email)
        references users(email)
);

-- User profile with less critical information
create table profile (
	email varchar(128),
    -- s3 file link
    profilepic varchar(128),
    -- Date of birth, as int epoch time
    dob int,
    -- in country alpha-2 code
    country char(2),
    -- store as string, since there are many formats
    phone varchar(32),
    mail_preferences tinyint default 0,
    -- Placeholder for text storage
    data text,
    -- Placeholder for boolean 1
    pref1 tinyint default 0,
    -- Placeholder for boolean 2
    pref2 tinyint default 0,
    primary key(email),
    
    constraint fk_emailforprofile
		foreign key(email)
        references users(email)
);

-- User balances in exchange
-- should have put a min 0 in all
create table userbalance (
	email varchar(128),
    -- max 999 999.99
    fiat decimal(8, 2) default 0,
    -- max 999 999. (18 dec pl)
    eth decimal(24, 18) default 0,
    -- max 999 999.9999
    santa decimal(10, 4) default 0,
    claus int default 0,
    primary key(email),

    constraint fk_emailforbalance
		foreign key(email)
        references users(email)
);

-- Favourites list of ethereum addresses
create table favourites (
	id int auto_increment,
    email varchar(128) not null,
    -- short tag of length 32
    tag varchar(32),
    ethaddress char(42),
    notes text,
    primary key(id),

    constraint fk_emailforfavourites
		foreign key(email)
        references users(email)
);