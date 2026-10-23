package com.legaldoc.analyzer.model;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public final class ApiModels {

    private ApiModels() {
    }

    public record SourceReference(int page, String passage) {
    }

    public record ImportantDate(
            String id,
            String label,
            String dateText,
            String isoDate,
            String urgency,
            boolean inferred,
            SourceReference source
    ) {
    }

    public record KeyTerm(
            String id,
            String title,
            String detail,
            String party,
            SourceReference source
    ) {
    }

    public record RiskFinding(
            String id,
            String level,
            String title,
            String whyItMatters,
            SourceReference source
    ) {
    }

    public record Analysis(
            String plainLanguageSummary,
            List<String> highlights,
            List<ImportantDate> importantDates,
            List<KeyTerm> keyTerms,
            List<RiskFinding> risks,
            String uncertaintyNote,
            String disclaimer
    ) {
    }

    public record DocumentResponse(
            String id,
            String name,
            String documentType,
            String status,
            Instant uploadedAt,
            int pageCount,
            long fileSize,
            Analysis analysis,
            String extractedText,
            String errorMessage
    ) {
    }

    public record DocumentListItem(
            String id,
            String name,
            String documentType,
            String status,
            Instant uploadedAt,
            int pageCount,
            int riskCount,
            String highestRisk,
            String nextDate
    ) {
    }

    public record ChatRequest(@NotBlank(message = "Question is required") String question) {
    }

    public record ChatResponse(
            String answer,
            List<SourceReference> sources,
            boolean foundInDocument,
            String disclaimer
    ) {
    }

    public record ErrorResponse(String code, String message, Instant timestamp) {
    }
}