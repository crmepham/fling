package com.fling.controller;

import com.fling.dto.execute.ExecuteRequest;
import com.fling.dto.execute.ExecuteResponse;
import com.fling.service.ExecuteService;
import com.fling.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/execute")
@RequiredArgsConstructor
public class ExecuteController {

    private final ExecuteService executeService;
    private final UserService userService;

    @PostMapping
    public ExecuteResponse execute(@Valid @RequestBody ExecuteRequest req) {
        return executeService.execute(userService.getDefaultUser(), req);
    }
}
