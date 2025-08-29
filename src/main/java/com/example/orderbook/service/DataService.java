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
            return Map.of("bids", List.of(), "asks", List.of(), "yellowBar", getEmptyYellowBar());
        }
        int index = dataIndex.get() % orderbookDataList.size();
        Map<String, Object> orderbook = orderbookDataList.get(index);
        
        // Calculate yellow bar data
        Map<String, Object> yellowBar = calculateYellowBarData(orderbook);
        
        // Add yellow bar to the response
        Map<String, Object> response = new java.util.HashMap<>(orderbook);
        response.put("yellowBar", yellowBar);
        
        return response;
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
    
    private Map<String, Object> calculateYellowBarData(Map<String, Object> orderbook) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> bids = (List<Map<String, Object>>) orderbook.get("bids");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> asks = (List<Map<String, Object>>) orderbook.get("asks");
        
        if (bids == null || bids.isEmpty() || asks == null || asks.isEmpty()) {
            return getEmptyYellowBar();
        }
        
        // Find best bid (highest price) and best ask (lowest price)
        Map<String, Object> bestBid = bids.stream()
                .max((b1, b2) -> Double.compare(
                        ((Number) b1.get("price")).doubleValue(),
                        ((Number) b2.get("price")).doubleValue()))
                .orElse(null);
        
        Map<String, Object> bestAsk = asks.stream()
                .min((a1, a2) -> Double.compare(
                        ((Number) a1.get("price")).doubleValue(),
                        ((Number) a2.get("price")).doubleValue()))
                .orElse(null);
        
        if (bestBid == null || bestAsk == null) {
            return getEmptyYellowBar();
        }
        
        double bestBidPrice = ((Number) bestBid.get("price")).doubleValue();
        double bestAskPrice = ((Number) bestAsk.get("price")).doubleValue();
        
        // Count orders at best bid and ask prices
        int bidOrderCount = (int) bids.stream()
                .filter(bid -> Math.abs(((Number) bid.get("price")).doubleValue() - bestBidPrice) < 0.001)
                .count();
        
        int askOrderCount = (int) asks.stream()
                .filter(ask -> Math.abs(((Number) ask.get("price")).doubleValue() - bestAskPrice) < 0.001)
                .count();
        
        // Sum shares at best bid and ask prices
        int bidShareCount = bids.stream()
                .filter(bid -> Math.abs(((Number) bid.get("price")).doubleValue() - bestBidPrice) < 0.001)
                .mapToInt(bid -> ((Number) bid.get("size")).intValue())
                .sum();
        
        int askShareCount = asks.stream()
                .filter(ask -> Math.abs(((Number) ask.get("price")).doubleValue() - bestAskPrice) < 0.001)
                .mapToInt(ask -> ((Number) ask.get("size")).intValue())
                .sum();
        
        return Map.of(
                "bidOrderCount", bidOrderCount,
                "bidShareCount", bidShareCount,
                "bidPrice", bestBidPrice,
                "askPrice", bestAskPrice,
                "askShareCount", askShareCount,
                "askOrderCount", askOrderCount
        );
    }
    
    private Map<String, Object> getEmptyYellowBar() {
        return Map.of(
                "bidOrderCount", 0,
                "bidShareCount", 0,
                "bidPrice", 0.0,
                "askPrice", 0.0,
                "askShareCount", 0,
                "askOrderCount", 0
        );
    }
}