FROM ghcr.io/railwayapp/nixpacks:ubuntu-1745885067

ENTRYPOINT ["/bin/bash", "-l", "-c"]
WORKDIR /app/


COPY .nixpacks/nixpkgs-23f9169c4ccce521379e602cc82ed873a1f1b52b.nix .nixpacks/nixpkgs-23f9169c4ccce521379e602cc82ed873a1f1b52b.nix
RUN nix-env -if .nixpacks/nixpkgs-23f9169c4ccce521379e602cc82ed873a1f1b52b.nix && nix-collect-garbage -d


ARG CI NIXPACKS_METADATA NIXPACKS_NODE_VERSION NIXPACKS_START_CMD NODE_ENV NPM_CONFIG_PRODUCTION
ENV CI=$CI NIXPACKS_METADATA=$NIXPACKS_METADATA NIXPACKS_NODE_VERSION=$NIXPACKS_NODE_VERSION NIXPACKS_START_CMD=$NIXPACKS_START_CMD NODE_ENV=$NODE_ENV NPM_CONFIG_PRODUCTION=$NPM_CONFIG_PRODUCTION

# setup phase
# noop

# install phase
ENV NIXPACKS_PATH=/app/node_modules/.bin:$NIXPACKS_PATH
COPY . /app/.
RUN --mount=type=cache,id=0734k439VF4-/root/local/share/pnpm/store/v3,target=/root/.local/share/pnpm/store/v3 npm install -g corepack@0.24.1 && corepack enable
RUN --mount=type=cache,id=0734k439VF4-/root/local/share/pnpm/store/v3,target=/root/.local/share/pnpm/store/v3 pnpm i --frozen-lockfile

# build phase
COPY . /app/.
RUN --mount=type=cache,id=0734k439VF4-apps/web/next/cache,target=/app/apps/web/.next/cache --mount=type=cache,id=0734k439VF4-node_modules/cache,target=/app/node_modules/.cache pnpm run build


RUN printf '\nPATH=/app/node_modules/.bin:$PATH' >> /root/.profile


# start
COPY . /app

CMD ["pnpm --filter @aiornot/db migrate && pnpm --filter @aiornot/db seed:tags && pnpm --filter @aiornot/db seed:demo && (pnpm --filter @aiornot/worker daemon:generate-media &) && pnpm --filter @aiornot/web start"]

