FROM nginx:1.29-alpine
# Uploads are owned by root; the root group keeps them readable for the nginx
# workers even if a file ends up 0640 (e.g. copied in by other tools).
RUN addgroup nginx root
COPY default.conf /etc/nginx/conf.d/default.conf
