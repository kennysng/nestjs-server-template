FROM node:18

COPY package.json package-lock.json ./

RUN npm install

COPY . ./

RUN npm run build

ENV NODE_ENV=production

EXPOSE 8080
CMD [ "npm", "start" ]
