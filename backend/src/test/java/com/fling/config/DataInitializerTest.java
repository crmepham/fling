package com.fling.config;

import com.fling.entity.User;
import com.fling.repository.EnvironmentRepository;
import com.fling.repository.RequestCollectionRepository;
import com.fling.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.ApplicationArguments;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DataInitializerTest {

    @Mock private UserRepository userRepository;
    @Mock private RequestCollectionRepository collectionRepository;
    @Mock private EnvironmentRepository environmentRepository;
    @Mock private ApplicationArguments args;

    @InjectMocks
    private DataInitializer dataInitializer;

    @Test
    void run_createsUserCollectionAndEnvironment_whenNoUsersExist() throws Exception {
        when(userRepository.findAll()).thenReturn(List.of());
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(collectionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(environmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        dataInitializer.run(args);

        verify(userRepository).save(any(User.class));
        verify(collectionRepository).save(any());
        verify(environmentRepository).save(any());
    }

    @Test
    void run_backfillsDefaultEnvironment_whenExistingUserHasNone() throws Exception {
        var existingUser = new User();
        when(userRepository.findAll()).thenReturn(List.of(existingUser));
        when(environmentRepository.countByUser(existingUser)).thenReturn(0L);
        when(environmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        dataInitializer.run(args);

        verify(userRepository, never()).save(any());
        verify(environmentRepository).save(any());
    }

    @Test
    void run_doesNotBackfill_whenExistingUserAlreadyHasEnvironments() throws Exception {
        var existingUser = new User();
        when(userRepository.findAll()).thenReturn(List.of(existingUser));
        when(environmentRepository.countByUser(existingUser)).thenReturn(1L);

        dataInitializer.run(args);

        verify(environmentRepository, never()).save(any());
    }

    @Test
    void run_backfillsDefaultEnvironment_withCorrectName() throws Exception {
        var existingUser = new User();
        when(userRepository.findAll()).thenReturn(List.of(existingUser));
        when(environmentRepository.countByUser(existingUser)).thenReturn(0L);

        var captor = ArgumentCaptor.forClass(com.fling.entity.Environment.class);
        when(environmentRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        dataInitializer.run(args);

        assertThat(captor.getValue().getName()).isEqualTo("Default");
        assertThat(captor.getValue().getUser()).isEqualTo(existingUser);
    }
}
