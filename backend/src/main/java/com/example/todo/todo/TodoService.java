package com.example.todo.todo;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TodoService {

    private final TodoRepository repository;

    public TodoService(TodoRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TodoResponse> findAll() {
        return repository.findAllByOrderByCompletedAscCreatedAtDesc()
                .stream()
                .map(TodoResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TodoResponse findById(Long id) {
        return TodoResponse.from(get(id));
    }

    public TodoResponse create(TodoRequest request) {
        Todo todo = new Todo();
        apply(todo, request);
        return TodoResponse.from(repository.save(todo));
    }

    public TodoResponse update(Long id, TodoRequest request) {
        Todo todo = get(id);
        apply(todo, request);
        return TodoResponse.from(repository.saveAndFlush(todo));
    }

    public TodoResponse toggle(Long id) {
        Todo todo = get(id);
        todo.setCompleted(!todo.isCompleted());
        return TodoResponse.from(repository.saveAndFlush(todo));
    }

    public void delete(Long id) {
        repository.delete(get(id));
    }

    public int deleteCompleted() {
        return repository.deleteAllCompleted();
    }

    private Todo get(Long id) {
        return repository.findById(id).orElseThrow(() -> new TodoNotFoundException(id));
    }

    private static void apply(Todo todo, TodoRequest request) {
        todo.setTitle(request.title().trim());
        String description = request.description();
        todo.setDescription(description == null || description.isBlank() ? null : description.trim());
        todo.setPriority(request.priority() == null ? Priority.MEDIUM : request.priority());
        todo.setDueDate(request.dueDate());
        if (request.completed() != null) {
            todo.setCompleted(request.completed());
        }
    }
}
