# Multi-stage Dockerfile for Order Service (.NET 8)
# Optimized for size, security, and build caching.

# ── Stage 1: Restore dependencies (cached layer) ─────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS restore
WORKDIR /src

COPY QuickApp.Core/QuickApp.Core.csproj QuickApp.Core/
COPY QuickApp.Server/QuickApp.Server.csproj QuickApp.Server/
RUN dotnet restore QuickApp.Server/QuickApp.Server.csproj \
    --runtime linux-musl-x64

# ── Stage 2: Build and publish ────────────────────────────────────────────────
FROM restore AS build
ARG BUILD_CONFIGURATION=Release

COPY QuickApp.Core/ QuickApp.Core/
COPY QuickApp.Server/ QuickApp.Server/

RUN dotnet publish QuickApp.Server/QuickApp.Server.csproj \
    -c $BUILD_CONFIGURATION \
    --runtime linux-musl-x64 \
    --self-contained false \
    -o /app/publish \
    /p:UseAppHost=false

# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

RUN apk add --no-cache icu-libs

EXPOSE 8080

USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["dotnet", "QuickApp.Server.dll"]
