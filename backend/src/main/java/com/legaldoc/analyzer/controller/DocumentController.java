package com.legaldoc.analyzer.controller;

import com.legaldoc.analyzer.model.ApiModels.ChatRequest;
import com.legaldoc.analyzer.model.ApiModels.ChatResponse;
import com.legaldoc.analyzer.model.ApiModels.DocumentListItem;
import com.legaldoc.analyzer.model.ApiModels.DocumentResponse;
import com.legaldoc.analyzer.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping
    public ResponseEntity<DocumentResponse> upload(@RequestPart("file") MultipartFile file) throws IOException {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(documentService.upload(file));
    }

    @GetMapping
    public List<DocumentListItem> list() {
        return documentService.list();
    }

    @GetMapping("/{id}")
    public DocumentResponse get(@PathVariable String id) {
        return documentService.get(id);
    }

    @PostMapping("/{id}/chat")
    public ChatResponse chat(@PathVariable String id, @Valid @RequestBody ChatRequest request) {
        return documentService.chat(id, request.question());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        documentService.delete(id);
        return ResponseEntity.noContent().build();
    }
}