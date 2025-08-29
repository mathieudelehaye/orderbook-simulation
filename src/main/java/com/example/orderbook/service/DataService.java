package com.example.orderbook.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class DataService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicInteger dataIndex = new AtomicInteger(0);
    
    private List<Map<String, Object>> orderbookDataList;
    private List<Map<String, Object>> tradesDataList;
    private List<Map<String, Object>> newsDataList;

    public DataService() {
        try {
            loadAllData();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void loadAllData() throws IOException {
        orderbookDataList = readJsonFile("data/orderbook-data.json", new TypeReference<List<Map<String, Object>>>() {});
        tradesDataList = readJsonFile("data/trades-data.json", new TypeReference<List<Map<String, Object>>>() {});
        newsDataList = readJsonFile("data/news-data.json", new TypeReference<List<Map<String, Object>>>() {});
    }

    public Map<String, Object> getOrderbookData() throws IOException {
        if (orderbookDataList == null || orderbookDataList.isEmpty()) {
            return Map.of("bids", List.of(), "asks", List.of());
        }
        int index = dataIndex.get() % orderbookDataList.size();
        return orderbookDataList.get(index);
    }

    public Map<String, Object> getTradesData() throws IOException {
        if (tradesDataList == null || tradesDataList.isEmpty()) {
            return Map.of("trades", List.of());
        }
        int index = dataIndex.get() % tradesDataList.size();
        return tradesDataList.get(index);
    }

    public Map<String, Object> getOhlcData() throws IOException {
        return readJsonFile("data/ohlc-data.json", new TypeReference<Map<String, Object>>() {});
    }

    public Map<String, Object> getTimeseriesData() throws IOException {
        return readJsonFile("data/timeseries-data.json", new TypeReference<Map<String, Object>>() {});
    }

    public Map<String, Object> getNewsData() throws IOException {
        if (newsDataList == null || newsDataList.isEmpty()) {
            return Map.of("news", List.of());
        }
        int index = dataIndex.get() % newsDataList.size();
        return newsDataList.get(index);
    }

    public void advanceDataIndex() {
        dataIndex.incrementAndGet();
    }

    private <T> T readJsonFile(String filePath, TypeReference<T> typeReference) throws IOException {
        ClassPathResource resource = new ClassPathResource(filePath);
        return objectMapper.readValue(resource.getInputStream(), typeReference);
    }
}