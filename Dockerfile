FROM node:20-slim

WORKDIR /app

# Enable hot reloading in many environments
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
