var particles = [ ];

function vlen(x, y, z) {
    return sqrt(x * x + y * y + z * z);
}

function setupUpdate() {
    var N = 100;
    var scale = 5;
    for(var i = 0; i < N; i++) {
        particles.push({
            px: scale * (random() - 0.5), vx: 0,
            py: scale * (random() - 0.5), vy: 0,
            pz: scale * (random() - 0.5), vz: 0
        })
    }
    broadcast("particles");
    particles.forEach(function(p) { log(p); });
}

function update() {
    var dt = 0.005;
    var gravity = 0.2;
    var vatt = 2;
    var kspring = 1;
    var d0 = 3;
    var steps = 2;
    for(var step = 0; step < steps; step++) {
        for(var i = 0; i < particles.length; i++) {
            particles[i].ax = 0;
            particles[i].ay = 0;
            particles[i].az = 0;
        }
        for(var i = 0; i < particles.length; i++) {
            var d = vlen(particles[i].px, particles[i].py, particles[i].pz);
            var s = gravity / d / d / d;
            particles[i].ax += -particles[i].px * s;
            particles[i].ay += -particles[i].py * s;
            particles[i].az += -particles[i].pz * s;
        }
        for(var i = 0; i < particles.length; i++) {
            for(var j = i + 1; j < particles.length; j++) {
                var dx = particles[i].px - particles[j].px;
                var dy = particles[i].py - particles[j].py;
                var dz = particles[i].pz - particles[j].pz;
                var d = vlen(dx, dy, dz);
                var s = kspring * (d - d0) * (d - d0) / d * (d > d0 ? -1 : 1);
                particles[i].ax += dx * s;
                particles[i].ay += dy * s;
                particles[i].az += dz * s;
                particles[j].ax -= dx * s;
                particles[j].ay -= dy * s;
                particles[j].az -= dz * s;
            }
        }
        for(var i = 0; i < particles.length; i++) {
            var s = vatt;
            particles[i].ax += -particles[i].vx * s;
            particles[i].ay += -particles[i].vy * s;
            particles[i].az += -particles[i].vz * s;
        }

        for(var i = 0; i < particles.length; i++) {
            particles[i].px += particles[i].vx * dt;
            particles[i].py += particles[i].vy * dt;
            particles[i].pz += particles[i].vz * dt;
            particles[i].vx += particles[i].ax * dt;
            particles[i].vy += particles[i].ay * dt;
            particles[i].vz += particles[i].az * dt;
        }
    }
    var angle = frameCount / 100;
    var s = 2;
    particles[0].px = s * sin(angle);
    particles[0].py = s * cos(angle);
    particles[0].pz = sin(angle * 10) / 5;
    broadcast("particles");
}

function event(e) {

}

function draw() {
    var draw_cube = function(x, y, z, scale) {
        GL.begin(GL.QUADS);
        GL.normal3f(+1, 0, 0);
        GL.vertex3f(x + scale, y + scale, z + scale);
        GL.vertex3f(x + scale, y - scale, z + scale);
        GL.vertex3f(x + scale, y - scale, z - scale);
        GL.vertex3f(x + scale, y + scale, z - scale);
        GL.normal3f(-1, 0, 0);
        GL.vertex3f(x - scale, y + scale, z + scale);
        GL.vertex3f(x - scale, y + scale, z - scale);
        GL.vertex3f(x - scale, y - scale, z - scale);
        GL.vertex3f(x - scale, y - scale, z + scale);

        GL.normal3f(0, +1, 0);
        GL.vertex3f(x + scale, y + scale, z + scale);
        GL.vertex3f(x + scale, y + scale, z - scale);
        GL.vertex3f(x - scale, y + scale, z - scale);
        GL.vertex3f(x - scale, y + scale, z + scale);
        GL.normal3f(0, -1, 0);
        GL.vertex3f(x + scale, y - scale, z + scale);
        GL.vertex3f(x - scale, y - scale, z + scale);
        GL.vertex3f(x - scale, y - scale, z - scale);
        GL.vertex3f(x + scale, y - scale, z - scale);

        GL.normal3f(0, 0, +1);
        GL.vertex3f(x + scale, y + scale, z + scale);
        GL.vertex3f(x - scale, y + scale, z + scale);
        GL.vertex3f(x - scale, y - scale, z + scale);
        GL.vertex3f(x + scale, y - scale, z + scale);
        GL.normal3f(0, 0, -1);
        GL.vertex3f(x + scale, y + scale, z - scale);
        GL.vertex3f(x + scale, y - scale, z - scale);
        GL.vertex3f(x - scale, y - scale, z - scale);
        GL.vertex3f(x - scale, y + scale, z - scale);
        GL.end(GL.QUADS);
    };
    Allosphere.shaderBegin(Allosphere.shaderDefault());
    Allosphere.shaderUniformf("lighting", 1);
    for(var i = 0; i < particles.length; i++) {
        var d = vlen(particles[i].px, particles[i].py, particles[i].pz);
        if(d > 0.5) {
            draw_cube(particles[i].px, particles[i].py, particles[i].pz, 0.1);
        }
    }
    Allosphere.shaderEnd(Allosphere.shaderDefault());
}
