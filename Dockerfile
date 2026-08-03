FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/

ARG GOOGLE_CLIENT_ID=__GOOGLE_CLIENT_ID__
RUN printf 'window.APP_CONFIG = {\n  clientId: "%s",\n};\n' \
    "$GOOGLE_CLIENT_ID" > /usr/share/nginx/html/config.js

EXPOSE 8080
