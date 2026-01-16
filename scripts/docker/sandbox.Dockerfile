FROM nixpkgs/nix-flakes:latest

WORKDIR /app

ENV EDITOR=nvim

RUN nix registry add nixpkgs github:numtide/nixpkgs-unfree/nixos-unstable && \
    nix profile install \
      nixpkgs#claude-code \
      nixpkgs#opencode \
      nixpkgs#git \
      nixpkgs#direnv \
      nixpkgs#nodejs_24 \
      nixpkgs#curl \
      nixpkgs#wget \
      nixpkgs#jq \
      nixpkgs#tree \
      nixpkgs#ripgrep \
      nixpkgs#gnused \
      nixpkgs#gnugrep \
      nixpkgs#gh \
      nixpkgs#bat \
      nixpkgs#fd \
      nixpkgs#htop \
      nixpkgs#neovim && \
    echo 'eval "$(direnv hook bash)"' >> /etc/bashrc && \
    echo 'alias lalph="npx -y lalph"' >> /etc/bashrc

RUN npm install -g lalph@latest

COPY scripts/docker/sandbox-entry.sh /usr/local/bin/sandbox-entry.sh
RUN chmod +x /usr/local/bin/sandbox-entry.sh

ENTRYPOINT ["/usr/local/bin/sandbox-entry.sh"]
