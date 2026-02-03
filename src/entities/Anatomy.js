export class Anatomy {
    constructor(entity) {
        this.entity = entity;
        this.parts = {};
    }
    
    init() {
        this.parts = {
            head: {
                eyes: [
                    { name: 'Left Eye', hp: 10, maxHP: 10, functional: true, cybernetic: false },
                    { name: 'Right Eye', hp: 10, maxHP: 10, functional: true, cybernetic: false }
                ],
                ears: [
                    { name: 'Left Ear', hp: 10, maxHP: 10, functional: true, cybernetic: false },
                    { name: 'Right Ear', hp: 10, maxHP: 10, functional: true, cybernetic: false }
                ],
                brain: { name: 'Brain', hp: 50, maxHP: 50, functional: true, cybernetic: false },
                jaw: { name: 'Jaw', hp: 20, maxHP: 20, functional: true, cybernetic: false }
            },
            torso: {
                heart: { name: 'Heart', hp: 40, maxHP: 40, functional: true, cybernetic: false },
                lungs: [
                    { name: 'Left Lung', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                    { name: 'Right Lung', hp: 30, maxHP: 30, functional: true, cybernetic: false }
                ],
                stomach: { name: 'Stomach', hp: 25, maxHP: 25, functional: true, cybernetic: false },
                liver: { name: 'Liver', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                kidneys: [
                    { name: 'Left Kidney', hp: 20, maxHP: 20, functional: true, cybernetic: false },
                    { name: 'Right Kidney', hp: 20, maxHP: 20, functional: true, cybernetic: false }
                ]
            },
            leftArm: {
                arm: { name: 'Left Arm', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                hand: { name: 'Left Hand', hp: 20, maxHP: 20, functional: true, cybernetic: false },
                fingers: []
            },
            rightArm: {
                arm: { name: 'Right Arm', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                hand: { name: 'Right Hand', hp: 20, maxHP: 20, functional: true, cybernetic: false },
                fingers: []
            },
            leftLeg: {
                leg: { name: 'Left Leg', hp: 35, maxHP: 35, functional: true, cybernetic: false },
                foot: { name: 'Left Foot', hp: 20, maxHP: 20, functional: true, cybernetic: false }
            },
            rightLeg: {
                leg: { name: 'Right Leg', hp: 35, maxHP: 35, functional: true, cybernetic: false },
                foot: { name: 'Right Foot', hp: 20, maxHP: 20, functional: true, cybernetic: false }
            }
        };
        
        for (let i = 0; i < 5; i++) {
            this.parts.leftArm.fingers.push({
                name: `Left Finger ${i + 1}`,
                hp: 5,
                maxHP: 5,
                functional: true,
                cybernetic: false
            });
            this.parts.rightArm.fingers.push({
                name: `Right Finger ${i + 1}`,
                hp: 5,
                maxHP: 5,
                functional: true,
                cybernetic: false
            });
        }
    }
    
    getVisionRange() {
        const leftEye = this.parts.head.eyes[0];
        const rightEye = this.parts.head.eyes[1];
        
        let range = 0;
        if (leftEye.functional) range += 5;
        if (rightEye.functional) range += 5;
        
        return range;
    }
    
    getHearingRange() {
        const leftEar = this.parts.head.ears[0];
        const rightEar = this.parts.head.ears[1];
        
        let range = 0;
        if (leftEar.functional) range += 3;
        if (rightEar.functional) range += 3;
        
        return range;
    }
    
    canUseHands() {
        return this.parts.leftArm.hand.functional || this.parts.rightArm.hand.functional;
    }
    
    getMovementPenalty() {
        let penalty = 0;
        if (!this.parts.leftLeg.leg.functional) penalty += 0.5;
        if (!this.parts.rightLeg.leg.functional) penalty += 0.5;
        return penalty;
    }
    
    installCybernetic(cyberneticData, slot) {
        return true;
    }
    
    damagePart(partPath, damage) {
    }
}
