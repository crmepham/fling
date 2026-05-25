package com.fling.repository;

import com.fling.entity.RequestCollection;
import com.fling.entity.SavedRequest;
import com.fling.entity.BodyType;
import com.fling.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import static org.assertj.core.api.Assertions.assertThat;

class RequestCollectionRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private RequestCollectionRepository collectionRepository;

    @Autowired
    private SavedRequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        requestRepository.deleteAll();
        collectionRepository.deleteAll();
        userRepository.deleteAll();

        user = userRepository.save(new User());
        otherUser = userRepository.save(new User());
    }

    @Test
    void findAllByUser_returnsOnlyCollectionsForThatUser() {
        createCollection(user, "Mine");
        createCollection(otherUser, "Not mine");

        var page = collectionRepository.findAllByUser(user, PageRequest.of(0, 10));

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getName()).isEqualTo("Mine");
    }

    @Test
    void findByIdAndUser_returnsEmpty_whenCollectionBelongsToOtherUser() {
        var other = createCollection(otherUser, "Other");

        var result = collectionRepository.findByIdAndUser(other.getId(), user);

        assertThat(result).isEmpty();
    }

    @Test
    void countByUser_returnsCorrectCount() {
        createCollection(user, "A");
        createCollection(user, "B");
        createCollection(otherUser, "C");

        assertThat(collectionRepository.countByUser(user)).isEqualTo(2);
    }

    private RequestCollection createCollection(User owner, String name) {
        var c = new RequestCollection();
        c.setUser(owner);
        c.setName(name);
        c.setDescription("");
        return collectionRepository.save(c);
    }

    private SavedRequest createRequest(RequestCollection collection, String name) {
        var r = new SavedRequest();
        r.setUser(collection.getUser());
        r.setCollection(collection);
        r.setName(name);
        r.setMethod("GET");
        r.setUrl("https://example.com");
        r.setBodyType(BodyType.NONE);
        return requestRepository.save(r);
    }
}
