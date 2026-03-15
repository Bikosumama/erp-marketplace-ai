FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
EXPOSE 5000
ENV DATABASE_URL=postgresql://erp_marketplace_db_user:faleF2uSnyQz2WAAYut2jsr7WOZ5jEtp@dpg-d6qon6aa214c739jdvng-a.oregon-postgres.render.com/erp_marketplace_db
CMD ["node", "server.js"]
