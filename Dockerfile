FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package.json server.mjs auth.mjs login.html lich_su_dang_on_thi_tuong_tac_2026.html ./
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
