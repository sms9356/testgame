#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "HaegyoCharacter.generated.h"

class UCameraComponent;
class USpotLightComponent;

// 플레이어: 1인칭 카메라 · 손전등(배터리) · 달리기(스태미나) · 앉기 · 상호작용 (웹 game.js 의 P 상태를 옮긴 것)
UCLASS()
class HAEGYOUE_API AHaegyoCharacter : public ACharacter
{
	GENERATED_BODY()
public:
	AHaegyoCharacter();
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Haegyo") UCameraComponent* Camera;
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Haegyo") USpotLightComponent* Flashlight;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") float Battery = 100.f;            // %
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") float BatteryDrainPerSec = 0.26f; // 웹: 100% ≈ 7~9분
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Haegyo") float Stamina = 100.f;
	UPROPERTY(EditAnywhere, Category = "Haegyo") float WalkSpeed = 280.f;   // 웹 2.8 m/s
	UPROPERTY(EditAnywhere, Category = "Haegyo") float RunSpeed = 500.f;    // 웹 5.0 m/s
	UPROPERTY(EditAnywhere, Category = "Haegyo") float CrouchSpeed = 145.f; // 웹 1.45 m/s
	UPROPERTY(EditAnywhere, Category = "Haegyo") float InteractRange = 180.f;
	UPROPERTY(BlueprintReadOnly, Category = "Haegyo") bool bLightOn = true;

	UFUNCTION(BlueprintCallable, Category = "Haegyo") void ToggleFlashlight();
	UFUNCTION(BlueprintCallable, Category = "Haegyo") void Interact();
	UFUNCTION(BlueprintPure, Category = "Haegyo") AActor* FindInteractTarget() const;

private:
	void MoveForward(float V);
	void MoveRight(float V);
	void RunPressed() { bWantRun = true; }
	void RunReleased() { bWantRun = false; }
	void CrouchToggle();
	void QuickSave();
	void QuickLoad();
	bool bWantRun = false;
	bool bTired = false;
};
