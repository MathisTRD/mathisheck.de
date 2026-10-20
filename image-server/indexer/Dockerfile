FROM node:22-alpine
WORKDIR /app
COPY indexer.mjs .
# Read access to root-owned uploads, even if a file ends up 0640 / dir 0750
RUN addgroup node root
USER node
EXPOSE 8080
CMD ["node", "indexer.mjs"]
