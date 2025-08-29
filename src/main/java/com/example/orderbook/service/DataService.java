package com.example.orderbook.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
public class DataService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Object getOrderbookData() throws IOException {
        return readJsonFile("data/orderbook-data.json", new TypeReference<Object>() {});
    }

    public Map<String, Object> getTradesData() throws IOException {
        return readJsonFile("data/trades-data.json", new TypeReference<Map<String, Object>>() {});
    }

    public Map<String, Object> getOhlcData() throws IOException {
        return readJsonFile("data/ohlc-data.json", new TypeReference<Map<String, Object>>() {});
    }

    public Map<String, Object> getTimeseriesData() throws IOException {
        return readJsonFile("data/timeseries-data.json", new TypeReference<Map<String, Object>>() {});
    }

    public Map<String, Object> getNewsData() throws IOException {
        return readJsonFile("data/news-data.json", new TypeReference<Map<String, Object>>() {});
    }

    private <T> T readJsonFile(String filePath, TypeReference<T> typeReference) throws IOException {
        ClassPathResource resource = new ClassPathResource(filePath);
        return objectMapper.readValue(resource.getInputStream(), typeReference);
    }
}