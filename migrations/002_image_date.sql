CREATE TYPE date_precision AS ENUM ('day', 'week', 'month', 'year');

ALTER TABLE images
    ADD COLUMN date_value     DATE           NULL,
    ADD COLUMN date_precision date_precision NULL;
