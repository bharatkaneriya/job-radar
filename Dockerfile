# docker build -t job-radar --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=... .
# docker run -p 3000:3000 --env-file .env job-radar
FROM node:24-alpine AS build
WORKDIR /app
# The in-memory MongoDB is for tests and dev only; don't download its binary here.
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Git doesn't keep the empty public/ folder.
RUN mkdir -p public
# NEXT_PUBLIC_ values are built into the browser code, so they can't come from `docker run`.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV BUILD_STANDALONE=1
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
