package com.example.todo.todo;

public class TodoNotFoundException extends RuntimeException {
    public TodoNotFoundException(Long id) {
        super("Todo " + id + " not found");
    }
}
