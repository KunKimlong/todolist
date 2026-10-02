package com.example.todo.todo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TodoRepository extends JpaRepository<Todo, Long> {

    List<Todo> findAllByOrderByCompletedAscCreatedAtDesc();

    @Modifying
    @Query("delete from Todo t where t.completed = true")
    int deleteAllCompleted();
}
