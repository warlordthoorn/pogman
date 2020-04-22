class PogGame {
    /*
    Based upon https://github.com/robynico/simple-pacman-d3js go check it out
    Newer version of d3 and general more recent js usages
     */
    constructor(id) {
        this.svg = d3.select(id);
        this.eventbus = new EventBus();
        this.then = Date.now();
        this.delta = null;
        this.intervalFps = 200 / 24;
        const self = this;
        this.width = +this.svg.attr("width") - 15;
        this.height = +this.svg.attr("height") - 15;

        this.xScale = d3.scaleLinear()
            .domain([0, map[0].length])
            .range([0, this.width]);

        this.yScale = d3.scaleLinear()
            .domain([0, map.length])
            .range([0, this.height]);

        this.size = 30;
        this.twitch = new Map(this.size, this.svg, this.eventbus, this.xScale, this.yScale);

        this.pogman = new Pogman(this.twitch.pogmanStartPosition, this.size, 2, this.eventbus, this.svg, this.xScale, this.yScale);
        this.apollos = [];
        this.twitch.apollosStartPosition.forEach(function (apolloPosition, i) {
            self.apollos.push(new Apollo(apolloPosition, self.size, 2, 'apollo' + i, self.eventbus, self.svg));
        });

        this.isDead = false;

        document.onkeydown = this.keyEvent;

        this.eventbus.addEventListener("dead", this.dead, this);
        this.eventbus.addEventListener("win", this.win, this);

        let modalDlg = document.querySelector('#popup');
        let imageModalCloseBtn = document.querySelector('#closing-pop-up');
        this.eventbus.addEventListener('click', function () {
            modalDlg.classList.add('is-active');
        }, this);

        imageModalCloseBtn.addEventListener('click', function () {
            modalDlg.classList.remove('is-active');
        });
        // start
        this.player = null;
        this.play();

    }

    play() {
        const self = this;
        if (!this.isDead) {
            this.player = window.setTimeout(self.play.bind(this), 1e3 / 60);
            self.now = Date.now();
            self.delta = self.now - self.then;
            if (self.delta > self.intervalFps) {
                self.then = self.now - (self.delta % self.intervalFps);
                self.movePogman();
                self.apollos.forEach(function (apollo) {
                    self.moveApollo(apollo);
                })
            }
        }
    }

    movePogman() {
        if (!this.twitch.isCollision(this.pogman, this.pogman.movement))
            this.pogman.move(this.pogman.movement);
        else {
            if (!this.twitch.isCollision(this.pogman, this.pogman.validMovement))
                this.pogman.move(this.pogman.validMovement);
        }
        this.isCollisionWithApollo();
    }

    isCollisionWithApollo() {
        let pogPos = this.getPosition(this.pogman);
        const self = this;
        this.apollos.forEach(function (apollo) {
            let apoPos = self.getPosition(apollo);
            if (apoPos.left < pogPos.right
                && apoPos.right > pogPos.left
                && apoPos.up < pogPos.down
                && apoPos.down > pogPos.up)
                self.eventbus.dispatch("dead", null);
        });
    }

    getPosition(char) {
        return {
            left: char.position.x - this.size,
            right: char.position.x,
            up: char.position.y - this.size,
            down: char.position.y
        };
    }

    moveApollo(apollo) {
        const me = this;
        while (true) {
            if (!me.twitch.isCollision(apollo, apollo.movement))
                break;
            else
                apollo.setNewRandomMovement();
        }
        apollo.move(apollo.movement);
    }

    dead() {
        clearTimeout(this.player);
        let audio = new Audio('audio/dead.mp3');
        audio.volume = 0.7;
        audio.play().then();
        this.display("OH NO NO NO", "How did you even die here, all the Apollos move randomly, soygamer")
    }

    win() {
        clearTimeout(this.player);
        let audio = new Audio('audio/won.mp3');
        audio.volume = 0.7;
        audio.play().then();
        this.display("VI VON", "Only a true gamer with X-Gamer can beat this game")
    }

    display(t, message) {
        let info = document.querySelector('#text-pop-up');
        let title = document.querySelector('#title-pop-up');
        info.appendChild(document.createElement('div')).textContent = message;
        title.appendChild(document.createTextNode(t));
        info.appendChild(document.createElement('div')).textContent = "If you want to restart, you have to refresh, I am to lazy to make this properly";
        this.eventbus.dispatch('click', null);
    }

    keyEvent(e) {
        if (e.key === "ArrowLeft") {
            pogGame.pogman.movement = {x: -1, y: 0};
        } else if (e.key === "ArrowUp") {
            pogGame.pogman.movement = {x: 0, y: -1};
        } else if (e.key === "ArrowRight") {
            pogGame.pogman.movement = {x: 1, y: 0};
        } else if (e.key === "ArrowDown") {
            pogGame.pogman.movement = {x: 0, y: 1};
        } else {
            console.log("Only arrow keys")
        }
    }

}

class EventBus {
    constructor() {
        this.listeners = {};
    }

    addEventListener(type, callback, scope) {
        if (!(type in this.listeners)) {
            this.listeners[type] = [{scope: scope, callback: callback}];
        } else {
            this.listeners[type].push({scope: scope, callback: callback});
        }
    }

    dispatch(type, target) {
        if (type in this.listeners) {
            for (let i = 0; i < this.listeners[type].length; i++) {
                let listener = this.listeners[type][i];
                if (listener && listener.callback) {
                    listener.callback.apply(listener.scope);
                }
            }
        }
    }
}

class Character {
    constructor(position, size, speed, eventbus) {
        this.eventbus = eventbus;
        this.position = position;
        this.svg = null;
        this.size = size;
        this.validMovement = {x: 0, y: 0};
        this.movement = {x: 0, y: 0};
        this.speed = speed;
    }

    move(movement) {
        this.validMovement = movement;
        this.position = {
            x: this.position.x + (this.validMovement.x * this.speed),
            y: this.position.y + (this.validMovement.y * this.speed)
        };
        this.draw();
    }

    getNextPosition(movement) {
        return {
            x: this.position.x + (movement.x * this.speed),
            y: this.position.y + (movement.y * this.speed)
        };
    }

    draw() {
        // override
    }
}

class Pogman extends Character {
    constructor(position, size, speed, eventbus, svg) {
        super(position, size, speed, eventbus);
        // TODO change to pogchamp
        this.width = 15;
        this.height = 15;

        this.pog = svg.append("svg:image")
            .attr("xlink:href", "img/pog1.png")
            .attr("class", this.name)
            .attr("height", 32)
            .attr("transform", "translate(" + this.position.x  + "," + this.position.y + ")");
    }

    isPogman() {
        return true;
    }

    draw() {
        let test = this.position.x - 15;
        let test2 = this.position.y - 15;
        this.pog.attr("transform", "translate(" + test + "," + test2 + ")" );
    }
}

class Apollo extends Character {
    constructor(position, size, speed, name, eventbus, svg) {
        super(position, size, speed, eventbus);
        this.svg = svg;
        this.name = name;
        this.width = 15;
        this.height = 15;

        this.intialDraw();
        this.setNewRandomMovement();
    }

    intialDraw() {
        this.svg.append("svg:image")
            .attr("xlink:href", "img/" + this.name + ".png")
            .attr("class", this.name)
            .attr("transform", this.getTranslate());

    }

    isPogman() {
        return false;
    }

    draw() {
        d3.selectAll('.' + this.name)
            .attr("transform", this.getTranslate());
    }

    getTranslate() {
        return "translate(" + (this.position.x - (26 / 2)) + "," + (this.position.y - ((this.size / 3) * 2)) + ")";
    }

    setNewRandomMovement() {
        this.movement = this.getRandomMovement();
        return this.movement;
    }

    getRandomMovement() {
        let randomMovement = {x: Math.floor(Math.random() * 3) - 1, y: Math.floor(Math.random() * 3) - 1};
        if (Math.abs(randomMovement.x) === Math.abs(randomMovement.y))
            return this.getRandomMovement();
        return randomMovement;
    }
}

const map = [
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"],
    ["#", "@", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", "^", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", "#"],
    ["#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#"],
    ["#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#"],
    ["#", ".", "#", "-", "-", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "-", "-", "#", ".", "#"],
    ["#", ".", "#", "-", "-", "#", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", "#", "-", "-", "#", ".", "#"],
    ["#", ".", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", ".", "#"],
    ["#", ".", ".", ".", ".", ".", ".", "#", "-", "-", "-", "-", "-", "-", "-", "-", "#", ".", "#", "-", "-", "-", "-", "-", "-", "-", "-", "#", ".", ".", ".", ".", ".", ".", "#"],
    ["#", ".", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", ".", "#"],
    ["#", ".", "#", "-", "-", "#", ".", ".", ".", "^", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", "^", ".", ".", ".", ".", ".", ".", ".", ".", "#", "-", "-", "#", ".", "#"],
    ["#", ".", "#", "-", "-", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "-", "-", "#", ".", "#"],
    ["#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#", "-", "-", "-", "-", "-", "#", ".", "#"],
    ["#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#", "#", "#", "#", "#", "#", "#", ".", "#"],
    ["#", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", "^", "#"],
    ["#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#", "#"]
];

class Map {
    constructor(size, svg, eventbus, xScale, yScale) {
        this.eventbus = eventbus;
        this.map = map;
        this.svg = svg;
        this.pathLength = size;
        this.pogmanStartPosition = null;
        this.apollosStartPosition = [];
        this.badges = {};
        this.xScale = xScale;
        this.yScale = yScale;
        this.draw()

    }

    draw() {
        for (let i = 0; i < map.length; i++) {
            for (let j = 0; j < map[i].length; j++) {
                if (map[i][j] === '@')
                    this.pogmanStartPosition = {
                        y: this.xScale(j) + this.pathLength / 2,
                        x: this.xScale(i) + this.pathLength / 2
                    };

                if (map[i][j] === '^')
                    this.apollosStartPosition.push({
                        y: this.xScale(i) + this.pathLength / 2,
                        x: this.xScale(j) + this.pathLength / 2
                    });


                if (map[i][j] === '.') {
                    let num = Math.floor(Math.random() * 5) + 1;
                    this.badges["badge_" + i + "_" + j] = this.svg
                        .append("svg:image")
                        .attr("xlink:href", "img/" + num + "m.png")
                        .attr("x", this.xScale(j) + this.pathLength / 4)
                        .attr("y", this.yScale(i) + this.pathLength / 4)
                        .attr("width", this.pathLength / 2)
                        .attr("height", this.pathLength / 2);
                }
                if (map[i][j] === '#') {
                    this.svg
                        .append("rect")
                        .attr("x", this.xScale(j))
                        .attr("y", this.yScale(i))
                        .attr("width", this.pathLength)
                        .attr("height", this.pathLength);
                }
            }
            this.totalBadge = this.size(this.badges);
        }
    }

    isCollision(char, movement) {
        let nextPosition = char.getNextPosition(movement);

        const leftUp = {
            x: Math.floor(this.xScale.invert(nextPosition.x - char.width)),
            y: Math.floor(this.yScale.invert(nextPosition.y - char.height))
        };

        const rightDown = {
            x: Math.floor(this.xScale.invert(nextPosition.x + char.width)),
            y: Math.floor(this.yScale.invert(nextPosition.y + char.height))
        };
        if (char.isPogman())
            this.isBadge(nextPosition, char);
        return !!(this.map[leftUp.y] && this.map[leftUp.y][leftUp.x] && this.map[leftUp.y][leftUp.x] === '#'
            || this.map[rightDown.y] && this.map[rightDown.y][rightDown.x] && this.map[rightDown.y][rightDown.x] === '#');

    }

    size(json) {
        let key, count = 0;
        for (key in json) {
            if (json.hasOwnProperty(key)) {
                count++;
            }
        }
        return count;
    }

    isBadge(position, char) {
        let middleX = 0, middleY = 0;

        if (char.movement.x === -1)
            middleX = 2;

        if (char.movement.y === -1)
            middleY = 2;

        const middle = {
            x: Math.floor(this.xScale.invert(position.x + middleX)),
            y: Math.floor(this.yScale.invert(position.y + middleY))
        };

        if (this.map[middle.y][middle.x] === '.') {
            this.map[middle.y][middle.x] = 'E';
            const block = this.badges['badge_' + middle.y + '_' + middle.x];
            if (block != null) {
                block.attr('opacity', 0);
                let audio = new Audio('audio/nam.mp3');
                audio.volume = 0.35;
                audio.play();
                delete this.badges['badge_' + middle.y + '_' + middle.x];
            }
            if (this.size(this.badges) === 0)
                this.eventbus.dispatch("win", null);
        }
    }
}
