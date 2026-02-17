#!/usr/bin/bash
#docker compose down -v
docker compose down
docker compose build --no-cache
docker compose up -d
docker ps -a
