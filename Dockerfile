FROM node:6-alpine

RUN mkdir -p /srv/node
COPY . /srv/node/
WORKDIR /srv/node
RUN yarn

CMD ./bin/www

