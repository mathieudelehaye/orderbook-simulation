package com.example.orderbook.handler;

import com.example.orderbook.service.DataService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class OrderbookWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final DataService dataService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OrderbookWebSocketHandler(DataService dataService) {
        this.dataService = dataService;
        startDataBroadcast();
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        System.out.println("WebSocket connection established: " + session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        System.out.println("WebSocket connection closed: " + session.getId());
    }

    private void startDataBroadcast() {
        scheduler.scheduleAtFixedRate(() -> {
            try {
                broadcastData("orderbook", dataService.getOrderbookData());
                broadcastData("trades", dataService.getTradesData());
                broadcastData("ohlc", dataService.getOhlcData());
                broadcastData("timeseries", dataService.getTimeseriesData());
                broadcastData("news", dataService.getNewsData());
                
                // Advance to next data set for next broadcast
                dataService.advanceDataIndex();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }, 0, 2, TimeUnit.SECONDS);
    }

    private void broadcastData(String type, Object data) throws Exception {
        Map<String, Object> message = Map.of(
            "type", type,
            "content", data
        );
        
        String json = objectMapper.writeValueAsString(message);
        TextMessage textMessage = new TextMessage(json);
        
        sessions.removeIf(session -> !session.isOpen());
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                session.sendMessage(textMessage);
            }
        }
    }
}