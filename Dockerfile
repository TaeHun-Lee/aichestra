FROM node:24.15.0-bookworm-slim

WORKDIR /workspace

ENV NODE_ENV=development
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile

EXPOSE 3000 3001

CMD ["pnpm", "--filter", "@aichestra/api", "dev"]
