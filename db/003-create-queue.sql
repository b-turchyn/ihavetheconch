CREATE TABLE queue (id INTEGER AUTO_INCREMENT, attendee_id INT NOT NULL, start_time INT UNSIGNED, PRIMARY KEY(id), INDEX(attendee_id), FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE);
