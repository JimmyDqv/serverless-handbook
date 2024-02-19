FROM amazoncorretto:17

VOLUME /tmp
COPY ./build/libs/demo-*.jar application.jar

ENV PORT 8080
EXPOSE $PORT

ENTRYPOINT ["java","-jar","/application.jar"]