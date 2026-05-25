package com.fling.repository;

import com.fling.entity.Environment;
import com.fling.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class EnvironmentRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private EnvironmentRepository environmentRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        environmentRepository.deleteAll();
        userRepository.deleteAll();
        user = userRepository.save(new User());
    }

    @Test
    void findByIdAndUser_returnsEmpty_whenEnvironmentBelongsToOtherUser() {
        var otherUser = userRepository.save(new User());
        var env = createEnvironment(otherUser, "Prod");

        var result = environmentRepository.findByIdAndUser(env.getId(), user);

        assertThat(result).isEmpty();
    }

    @Test
    void existsByUserAndNameAndIdNot_returnsTrue_whenDuplicateNameExists() {
        var existing = createEnvironment(user, "Staging");
        var other = createEnvironment(user, "Dev");

        assertThat(environmentRepository.existsByUserAndNameAndIdNot(user, "Dev", existing.getId())).isTrue();
    }

    @Test
    void existsByUserAndNameAndIdNot_returnsFalse_whenCheckingAgainstOwnId() {
        var env = createEnvironment(user, "Staging");

        assertThat(environmentRepository.existsByUserAndNameAndIdNot(user, "Staging", env.getId())).isFalse();
    }

    @Test
    void countByUser_returnsCorrectCount() {
        createEnvironment(user, "Dev");
        createEnvironment(user, "Prod");
        var otherUser = userRepository.save(new User());
        createEnvironment(otherUser, "Dev");

        assertThat(environmentRepository.countByUser(user)).isEqualTo(2);
    }

    @Test
    void countByUser_returnsZero_whenUserHasNoEnvironments() {
        assertThat(environmentRepository.countByUser(user)).isZero();
    }

    private Environment createEnvironment(User owner, String name) {
        var env = new Environment();
        env.setUser(owner);
        env.setName(name);
        return environmentRepository.save(env);
    }
}
