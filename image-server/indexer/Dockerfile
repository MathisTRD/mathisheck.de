FROM node:22-alpine
WORKDIR /app
COPY indexer.mjs .
# Read access to files/dirs File Browser creates as root:root 0640 / 0750
RUN addgroup node root
USER node
EXPOSE 8080
CMD ["node", "indexer.mjs"]
