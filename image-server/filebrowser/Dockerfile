FROM gtstef/filebrowser:2.0.1-stable-slim
# Config is baked into the image; the data volume only holds the database
COPY config.yaml /home/filebrowser/config.yaml
ENV FILEBROWSER_CONFIG=/home/filebrowser/config.yaml
ENV FILEBROWSER_DATABASE_PATH=/home/filebrowser/data/database.sqlite
