# Use OpenJDK 17 as the base image
FROM openjdk:17-jdk-slim

# Set working directory
WORKDIR /app

# Copy Gradle wrapper and build files first (for better layer caching)
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .

# Make Gradle wrapper executable
RUN chmod +x ./gradlew

# Download dependencies (this layer will be cached if build.gradle doesn't change)
RUN ./gradlew dependencies --no-daemon

# Copy source code
COPY src ./src

# Build the application
RUN ./gradlew bootJar --no-daemon

# Expose the port that Spring Boot runs on
EXPOSE 8080

# Set environment variable for Spring Boot
ENV SPRING_PROFILES_ACTIVE=prod

# Run the Spring Boot application
CMD ["java", "-Dserver.port=${PORT:-8080}", "-jar", "build/libs/orderbook-simulation-0.0.1-SNAPSHOT.jar"]