FROM nginx:1.29-alpine
# File Browser (running as root) creates files 0640 / dirs 0750 owned by root:root;
# the root group lets the nginx workers read them.
RUN addgroup nginx root
COPY default.conf /etc/nginx/conf.d/default.conf
