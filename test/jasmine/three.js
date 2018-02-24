describe('test', () => {
    it('three.js', () => {
        expect(true).toBeTruthy()

    });
    it("Instancing", (assert) => {

        var mixer = new AnimationMixer();
        var clip = new AnimationClip("nonname", - 1, []);

        var animationAction = new AnimationAction(mixer, clip);
        assert.ok(animationAction, "animationAction instanciated");

    });
})